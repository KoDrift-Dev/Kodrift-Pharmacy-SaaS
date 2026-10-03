"use server";

import { createServer } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CartItem } from "./pos-client"; // We will export this type in the next step

const CheckoutItemSchema = z.object({
  medicineId: z.string().min(1),
  quantity: z.number().int().positive().max(10000),
  saleType: z.enum(["Pack", "Unit"]),
  discountType: z.enum(["None", "Percentage", "Fixed"]),
  discountValue: z.number().min(0).max(100000),
});

export async function processCheckout(cartItems: CartItem[], totalAmount: number) {
  // 0. Only logged-in staff with a sales role may check out
  const { session, error: guardError } = await requireSession([
    "Super Admin",
    "Admin",
    "Manager",
    "Cashier",
  ]);
  if (guardError) return { error: guardError };

  // 1. Validate the shape of the cart — trust nothing else from the client.
  //    Prices, stock and discounts are re-verified against the database below.
  const parsed = z
    .array(CheckoutItemSchema)
    .min(1, "Cart is empty")
    .max(200, "Cart is too large")
    .safeParse(
      cartItems.map((i) => ({
        medicineId: i?.medicine?.id,
        quantity: i?.quantity,
        saleType: i?.saleType,
        discountType: i?.discountType ?? "None",
        discountValue: i?.discountValue ?? 0,
      }))
    );
  if (!parsed.success) {
    return { error: "Invalid cart data. Please rebuild the cart and try again." };
  }
  const items = parsed.data;

  const supabase = await createServer();

  // 2. If any discount is applied, the staff member must have permission
  const discountRequested = items.some(
    (i) => i.discountType !== "None" && i.discountValue > 0
  );
  if (discountRequested) {
    const { data: staffPerms } = await supabase
      .from("staff")
      .select("can_give_discount")
      .eq("id", session.staffId)
      .single();
    if (!staffPerms?.can_give_discount) {
      return { error: "Your staff account is not allowed to give discounts." };
    }
  }

  // 3. Re-fetch authoritative prices & stock from the database
  const ids = [...new Set(items.map((i) => i.medicineId))];
  const { data: dbMeds, error: medErr } = await supabase
    .from("medicines")
    .select("id, name, pack_size, stock, cost_price, sale_price")
    .in("id", ids);
  if (medErr || !dbMeds) {
    return { error: "Could not verify inventory. Please try again." };
  }
  const medById = new Map(dbMeds.map((m) => [m.id, m]));

  // 4. Compute line totals server-side and validate stock
  let totalAmountServer = 0;
  let totalProfit = 0;
  const lines: {
    medicine_id: string;
    quantity: number;
    sale_type: string;
    price: number;
    profit: number;
    unitsToDeduct: number;
    name: string;
  }[] = [];

  for (const item of items) {
    const med = medById.get(item.medicineId);
    if (!med) return { error: "One of the cart items no longer exists." };

    const packSize = med.pack_size || 1;
    const isPack = item.saleType === "Pack";
    const unitsToDeduct = isPack ? item.quantity * packSize : item.quantity;

    if (med.stock < unitsToDeduct) {
      return { error: `Insufficient stock for "${med.name}". Available: ${med.stock} units.` };
    }

    const gross = isPack
      ? med.sale_price * item.quantity
      : (med.sale_price / packSize) * item.quantity;
    const cost = isPack
      ? med.cost_price * item.quantity
      : (med.cost_price / packSize) * item.quantity;

    // Validate discount bounds server-side
    let discount = 0;
    if (item.discountType === "Percentage") {
      if (item.discountValue > 100) return { error: "Invalid percentage discount." };
      discount = gross * (item.discountValue / 100);
    } else if (item.discountType === "Fixed") {
      if (item.discountValue > gross) return { error: "Discount cannot exceed the item price." };
      discount = item.discountValue;
    }

    const net = Math.max(0, gross - discount);
    totalAmountServer += net;
    totalProfit += net - cost;

    lines.push({
      medicine_id: med.id,
      quantity: item.quantity,
      sale_type: item.saleType,
      price: Math.round(net * 100) / 100,
      profit: Math.round((net - cost) * 100) / 100,
      unitsToDeduct,
      name: med.name,
    });
  }

  totalAmountServer = Math.round(totalAmountServer * 100) / 100;
  totalProfit = Math.round(totalProfit * 100) / 100;

  // 5. Create the master sale record with SERVER-computed totals
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .insert([
      {
        total_amount: totalAmountServer,
        net_total: totalAmountServer,
        profit: totalProfit,
      },
    ])
    .select()
    .single();

  if (saleErr || !sale) {
    return { error: "Failed to create sale record: " + saleErr?.message };
  }

  // 6. Record line items and deduct stock (from DB stock, not client stock)
  for (const line of lines) {
    const { error: itemErr } = await supabase.from("sale_items").insert([
      {
        sale_id: sale.id,
        medicine_id: line.medicine_id,
        quantity: line.quantity,
        sale_type: line.sale_type,
        price: line.price,
        profit: line.profit,
      },
    ]);
    if (itemErr) {
      return { error: "Failed to record sale items: " + itemErr.message };
    }

    const med = medById.get(line.medicine_id)!;
    const { error: stockErr } = await supabase
      .from("medicines")
      .update({ stock: med.stock - line.unitsToDeduct })
      .eq("id", line.medicine_id);
    if (stockErr) {
      return { error: "Failed to update stock: " + stockErr.message };
    }
  }

  // 7. Refresh all relevant pages so the new stock levels show up instantly
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/sales");

  return { success: true, message: "Checkout completed successfully!" };
}

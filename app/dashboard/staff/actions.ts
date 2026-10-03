"use server";

import { createServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { requireSession } from "@/lib/auth";

export type ActionState = {
  error?: string;
  success?: string;
};

const StaffSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.enum(["Super Admin", "Admin", "Manager", "Cashier"]),
  shift: z.enum(["Morning", "Evening", "Night", "Flexible"]),
  base_salary: z.coerce.number().min(0, "Salary cannot be negative"),
  commission_rate: z.coerce.number().min(0).max(100).optional().default(0),
  phone: z.string().optional(),
  status: z.enum(["Active", "Inactive"]),
  email: z.string().email("A valid email is required"),
  password_hash: z.string().min(6, "Password must be at least 6 characters"),
});

export async function addStaff(prevState: ActionState, formData: FormData): Promise<ActionState> {
  const { error: guardError } = await requireSession(["Admin", "Super Admin"]);
  if (guardError) return { error: guardError };

  const supabase = await createServer();
  const validatedFields = StaffSchema.safeParse(Object.fromEntries(formData));

  if (!validatedFields.success) {
    const firstIssue = validatedFields.error.issues[0];
    return { error: `Check input for "${String(firstIssue.path[0])}": ${firstIssue.message}` };
  }

  const can_give_discount = formData.get("can_give_discount") === "on";
  const can_delete_sales = formData.get("can_delete_sales") === "on";
  const can_view_reports = formData.get("can_view_reports") === "on";

  let cnic_url = null;
  const file = formData.get("cnic_document") as File | null;
  if (file && file.size > 0) {
    if (file.size > 5 * 1024 * 1024) return { error: "CNIC file size must be less than 5MB" };
    const fileExt = (file.name.split('.').pop() || '').toLowerCase();
    const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'pdf'];
    if (!ALLOWED_EXTS.includes(fileExt)) {
      return { error: "CNIC document must be a JPG, PNG or PDF file." };
    }
    const fileName = `cnic_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `staff_docs/${fileName}`;
    
    const { error: uploadError } = await supabase.storage.from('staff_docs').upload(filePath, file);
    if (uploadError) return { error: "Failed to upload CNIC: " + uploadError.message };
    
    const { data: publicUrlData } = supabase.storage.from('staff_docs').getPublicUrl(filePath);
    cnic_url = publicUrlData.publicUrl;
  }

  const hashedPassword = await bcrypt.hash(validatedFields.data.password_hash, 10);

  const { error } = await supabase.from("staff").insert([
    { 
      ...validatedFields.data, 
      password_hash: hashedPassword,
      can_give_discount,
      can_delete_sales,
      can_view_reports,
      cnic_url
    },
  ]);

  if (error) {
    if (error.code === "23505") return { error: "This email is already registered." };
    return { error: "Database error: " + error.message };
  }

  revalidatePath("/dashboard/staff");
  return { success: "Staff member added successfully!" };
}

// NAYA: Attendance Function
export async function markAttendance(formData: FormData) {
  const { error: guardError } = await requireSession(["Admin", "Super Admin", "Manager"]);
  if (guardError) return;

  const supabase = await createServer();
  const staff_id = String(formData.get("staff_id"));
  const status = String(formData.get("status")); // Present, Absent, Leave
  if (!["Present", "Absent", "Leave"].includes(status)) return;
  const today = new Date().toISOString().split('T')[0];

  // Upsert lagayenge taake agar pehle se hazri lagi hai toh update ho jaye, warna insert ho
  await supabase.from("staff_attendance").upsert({
    staff_id,
    date: today,
    status
  }, { onConflict: 'staff_id, date' });

  revalidatePath("/dashboard/staff");
}

export async function payStaffSalary(formData: FormData) {
  const { error: guardError } = await requireSession(["Admin", "Super Admin"]);
  if (guardError) return;

  const supabase = await createServer();
  const staffName = String(formData.get("staff_name")).slice(0, 120);
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description")).slice(0, 300);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    return;
  }

  await supabase.from("expenses").insert([{
    title: `Salary/Advance: ${staffName} - ${description}`,
    category: "Salary",
    amount: amount,
    expense_date: new Date().toISOString(),
    payment_method: "Cash",
    vendor_name: staffName
  }]);

  revalidatePath("/dashboard/staff");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/reports");
}

export async function toggleStaffStatus(formData: FormData) {
  const { error: guardError } = await requireSession(["Admin", "Super Admin"]);
  if (guardError) return;
  const supabase = await createServer();
  const id = String(formData.get("id"));
  const currentStatus = String(formData.get("current_status"));
  const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
  await supabase.from("staff").update({ status: newStatus }).eq("id", id);
  revalidatePath("/dashboard/staff");
}

export async function deleteStaff(formData: FormData) {
  const { error: guardError } = await requireSession(["Super Admin"]);
  if (guardError) return;
  const supabase = await createServer();
  const id = String(formData.get("id"));
  await supabase.from("staff").delete().eq("id", id);
  revalidatePath("/dashboard/staff");
}
// ADD THIS AT THE BOTTOM OF actions.ts

export async function updateStaffFinancials(formData: FormData) {
  const { error: guardError } = await requireSession(["Admin", "Super Admin"]);
  if (guardError) return;

  const supabase = await createServer();
  const id = String(formData.get("id"));
  const base_salary = Number(formData.get("base_salary"));
  const commission_rate = Number(formData.get("commission_rate"));
  if (!Number.isFinite(base_salary) || base_salary < 0 || base_salary > 100000000) {
    return { error: "Please enter a valid salary amount." };
  }
  if (!Number.isFinite(commission_rate) || commission_rate < 0 || commission_rate > 100) {
    return { error: "Commission rate must be between 0 and 100." };
  }

  await supabase.from("staff").update({ 
    base_salary, 
    commission_rate 
  }).eq("id", id);

  revalidatePath("/dashboard/staff");
}
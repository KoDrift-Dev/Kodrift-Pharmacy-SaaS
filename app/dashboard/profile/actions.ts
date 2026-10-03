"use server";

import { createServer } from "@/lib/supabase/server";
import { requireSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type ActionState = {
  error?: string;
  success?: string;
};

export async function logAttendance(type: "Login" | "Logout") {
  const { session, error: guardError } = await requireSession();
  if (guardError || !session.staffId) return { error: guardError ?? "Not logged in." };

  const supabase = await createServer();

  // staff_id always comes from the verified session — never from the client
  const { error } = await supabase.from("staff_activity").insert([
    {
      staff_id: session.staffId,
      type: type,
      status: "Completed",
      details: `Staff member clocked ${type === "Login" ? "in" : "out"}`,
    },
  ]);

  if (error) return { error: error.message };

  revalidatePath("/dashboard/profile");
  return { success: `Successfully clocked ${type === "Login" ? "in" : "out"}!` };
}

const LeaveSchema = z.object({
  leave_date: z.string().min(1, "Date is required"),
  reason: z.string().min(5, "Please provide a valid reason").max(500),
});

export async function submitLeaveRequest(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session, error: guardError } = await requireSession();
  if (guardError || !session.staffId) return { error: guardError ?? "Not logged in." };

  const supabase = await createServer();
  const validatedFields = LeaveSchema.safeParse(Object.fromEntries(formData));

  if (!validatedFields.success) {
    return { error: "Please fill out all fields correctly." };
  }

  const { leave_date, reason } = validatedFields.data;

  const { error } = await supabase.from("staff_activity").insert([
    {
      staff_id: session.staffId,
      type: "LeaveRequest",
      status: "Pending",
      details: `Date: ${leave_date} | Reason: ${reason}`,
    },
  ]);

  if (error) return { error: "Failed to submit request: " + error.message };

  revalidatePath("/dashboard/profile");
  return { success: "Leave request submitted to Admin for approval!" };
}

"use server";

import { createServer } from "@/lib/supabase/server";
import { createSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

// --- Best-effort login rate limiting (per email) ---
// Note: in serverless environments this is per-instance memory, so it is a
// defense-in-depth layer, not a replacement for a persistent store.
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function processLogin(prevState: any, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password || !role) {
    return { error: "Please fill in email, role and password." };
  }

  if (isRateLimited(`login:${email}`)) {
    return { error: "Too many login attempts. Please wait a few minutes and try again." };
  }

  const supabase = await createServer();

  const { data: staffMember, error } = await supabase
    .from("staff")
    .select("id, name, email, role, status, password_hash")
    .eq("email", email)
    .single();

  // Generic message on purpose: don't reveal whether the email exists
  if (error || !staffMember) {
    return { error: "Invalid email or password." };
  }

  if (staffMember.status === "Inactive") {
    return { error: "This account has been deactivated. Please contact the Super Admin." };
  }

  if (staffMember.role !== role) {
    return { error: `Access Denied. You are registered as a ${staffMember.role}, not a ${role}.` };
  }

  const passwordValid = await bcrypt.compare(password, staffMember.password_hash ?? "");

  if (!passwordValid) {
    return { error: "Invalid email or password." };
  }

  // Signed, httpOnly, expiring session cookie (see lib/auth.ts)
  await createSession({
    id: staffMember.id,
    role: staffMember.role,
    name: staffMember.name,
  });

  redirect("/dashboard");
}

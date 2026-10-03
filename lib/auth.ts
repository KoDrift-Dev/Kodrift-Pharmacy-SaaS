"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "alazamat_session";
// Session lifetime: 12 hours
const SESSION_MAX_AGE = 12 * 60 * 60;

type SessionPayload = {
  staffId: string;
  role: string;
  name: string;
  iat: number;
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is not configured. Set a random 32+ character secret in your environment variables."
    );
  }
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("hex");
}

function seal(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function unseal(value: string): SessionPayload | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  if (signature.length !== expected.length) return null;
  // Timing-safe comparison so signatures can't be probed byte-by-byte
  if (!timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.staffId || !payload.role || typeof payload.iat !== "number") return null;
    // Expire old sessions
    if (Date.now() - payload.iat > SESSION_MAX_AGE * 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export type Session = {
  isLoggedIn: boolean;
  role: string;
  staffId: string | null;
  name: string | null;
};

const LOGGED_OUT: Session = {
  isLoggedIn: false,
  role: "Guest",
  staffId: null,
  name: null,
};

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return LOGGED_OUT;

  const payload = unseal(raw);
  if (!payload) return LOGGED_OUT;

  return {
    isLoggedIn: true,
    role: payload.role,
    staffId: payload.staffId,
    name: payload.name,
  };
}

/** Create the signed session cookie after a successful login. */
export async function createSession(staff: { id: string; role: string; name: string }) {
  const cookieStore = await cookies();
  const value = seal({
    staffId: staff.id,
    role: staff.role,
    name: staff.name,
    iat: Date.now(),
  });
  cookieStore.set(COOKIE_NAME, value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // Only send over HTTPS in production
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Shared guard for Server Actions. Returns { error: null } when the
 * caller is clear to proceed, or { error: "..." } when it's a guest
 * or lacks a required role. Use this instead of ad-hoc isLoggedIn
 * checks so every action is protected the same way.
 */
export async function requireSession(allowedRoles?: string[]) {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return {
      session,
      error: "View-Only Demo Mode: Please log in with a Staff account to perform this action.",
    };
  }

  if (allowedRoles && !allowedRoles.includes(session.role)) {
    return {
      session,
      error: `Access Denied. This action requires one of: ${allowedRoles.join(", ")}.`,
    };
  }

  return { session, error: null };
}

export async function processLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/dashboard");
}

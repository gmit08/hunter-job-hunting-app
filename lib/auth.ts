import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { configuredPassword } from "./mode";

export const SESSION_COOKIE = "gm_dashboard";

export function passwordConfigured(): boolean {
  return Boolean(configuredPassword());
}

export function sessionToken(password: string): string {
  return createHash("sha256").update(`gm-job-dashboard-v1:${password}`).digest("hex");
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  const expected = configuredPassword();
  if (!expected) return true;
  const value = jar.get(SESSION_COOKIE)?.value;
  if (!value) return false;
  const token = sessionToken(expected);
  const left = Buffer.from(value);
  const right = Buffer.from(token);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

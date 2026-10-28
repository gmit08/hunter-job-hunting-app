import { NextResponse } from "next/server";
import { cookieOptions, passwordConfigured, passwordsMatch, SESSION_COOKIE, sessionToken } from "@/lib/auth";
import { configuredPassword } from "@/lib/mode";

const attempts = new Map<string, { count: number; lockedUntil: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}

export async function POST(request: Request) {
  const key = clientKey(request);
  const current = attempts.get(key);
  if (current && current.lockedUntil > Date.now()) {
    return NextResponse.redirect(new URL("/login?error=locked", request.url), 303);
  }

  const form = await request.formData().catch(() => null);
  const password = String(form?.get("password") ?? "");
  const expected = configuredPassword();

  if (!passwordConfigured()) {
    return NextResponse.redirect(new URL("/", request.url), 303);
  }

  if (!passwordsMatch(password, expected)) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const next = {
      count: (current && current.lockedUntil <= Date.now() ? current.count : current?.count ?? 0) + 1,
      lockedUntil: 0,
    };
    if (next.count >= 8) {
      next.lockedUntil = Date.now() + 10 * 60 * 1000;
      next.count = 0;
    }
    attempts.set(key, next);
    const code = next.lockedUntil ? "locked" : "1";
    return NextResponse.redirect(new URL(`/login?error=${code}`, request.url), 303);
  }

  attempts.delete(key);
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.set(SESSION_COOKIE, sessionToken(expected), cookieOptions());
  return response;
}

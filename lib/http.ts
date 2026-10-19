import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/auth";

export async function requireUser(): Promise<NextResponse | null> {
  if (await isAuthed()) return null;
  return NextResponse.json(
    { ok: false, message: "Please sign in again." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

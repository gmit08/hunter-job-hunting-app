import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { isAuthed, passwordConfigured } from "@/lib/auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-16 text-sm text-muted-foreground">Loading…</main>}>
      <LoginGate searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginGate({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  if (!passwordConfigured()) redirect("/");
  if (await isAuthed()) redirect("/");
  const params = await searchParams;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;
  return <LoginForm error={error} />;
}

import { HunterLogo } from "@/components/hunter-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ error }: { error?: string }) {
  const message =
    error === "locked"
      ? "Too many tries. Wait ten minutes, then try again."
      : error
        ? "That password doesn’t match."
        : "";

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="flex items-center gap-2 text-primary">
        <HunterLogo className="size-8" />
        <p className="font-heading text-2xl leading-none font-medium tracking-tight text-foreground">Hunter</p>
      </div>
      <h1 className="mt-2 font-heading text-4xl font-medium tracking-tight">Welcome back</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Enter the dashboard password to open your applications.
      </p>
      <form action="/api/login" method="post" className="mt-8 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          className="mt-2 h-11 px-3 text-base"
        />
        {message ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {message}
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">The password stays on the server. It is not stored in the sheet.</p>
        )}
        <Button type="submit" className="mt-5 h-11 w-full text-base">
          Continue
        </Button>
      </form>
    </main>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, SignInRequired } from "@/components/api-client";
import { HunterLogo } from "@/components/hunter-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

export function AppMenu({
  paused,
  webhookReady,
  passwordProtected,
  openCount,
}: {
  paused: boolean;
  webhookReady: boolean;
  passwordProtected: boolean;
  openCount: number;
}) {
  const router = useRouter();
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pauseOn, setPauseOn] = useState(paused);
  const [seenPaused, setSeenPaused] = useState(paused);
  const [pausePending, setPausePending] = useState(false);
  if (paused !== seenPaused) {
    setSeenPaused(paused);
    setPauseOn(paused);
  }
  const [pauseMessage, setPauseMessage] = useState("");
  const [pauseError, setPauseError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState("");
  const [runError, setRunError] = useState("");

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  async function togglePause(next: boolean) {
    const previous = pauseOn;
    setPauseOn(next);
    setPauseMessage("");
    setPauseError("");
    setPausePending(true);
    try {
      const result = await postJson<{ message: string }>("/api/pause", { paused: next });
      setPauseMessage(result.message);
      router.refresh();
    } catch (error) {
      if (error instanceof SignInRequired) {
        router.push("/login");
        return;
      }
      setPauseOn(previous);
      setPauseError(error instanceof Error ? error.message : "The pause switch did not save.");
    } finally {
      setPausePending(false);
    }
  }

  async function runBacklog() {
    setRunning(true);
    setRunMessage("");
    setRunError("");
    try {
      const result = await postJson<{ message: string }>("/api/backlog", {});
      setRunMessage(result.message);
      setConfirming(false);
      setOpen(true);
    } catch (error) {
      if (error instanceof SignInRequired) {
        router.push("/login");
        return;
      }
      setRunError(error instanceof Error ? error.message : "The routine did not start.");
      setOpen(true);
    } finally {
      setRunning(false);
    }
  }

  function go(hash: string) {
    setOpen(false);
    document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5 text-primary">
          <HunterLogo className="size-8" />
          <h1 className="font-heading text-2xl leading-none font-medium tracking-tight text-foreground">Hunter</h1>
        </div>
        <button
          ref={buttonRef}
          type="button"
          className="flex size-11 flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-muted aria-expanded:bg-card aria-expanded:ring-1 aria-expanded:ring-foreground/10"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="block h-0.5 w-4 rounded-full bg-foreground" />
          <span className="block h-0.5 w-4 rounded-full bg-foreground" />
          <span className="block h-0.5 w-4 rounded-full bg-foreground" />
        </button>
      </div>

      {open ? <div className="fixed inset-x-0 top-16 bottom-0 z-40 bg-foreground/15 lg:bg-transparent" /> : null}
      <nav
        ref={panelRef}
        id={menuId}
        aria-label="Hunter"
        hidden={!open}
        className="absolute top-[4.25rem] right-3 z-50 w-[min(20rem,calc(100%-1.5rem))] rounded-2xl bg-popover p-2 shadow-xl ring-1 ring-foreground/10 sm:right-6"
      >
        <button type="button" className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left font-medium hover:bg-muted" onClick={() => go("#questions")}>
          Questions
          <span className="grid min-w-6 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">{openCount}</span>
        </button>
        <button type="button" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-medium hover:bg-muted" onClick={() => go("#overview")}>
          Overview
        </button>
        <button type="button" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-medium hover:bg-muted" onClick={() => go("#applications")}>
          Applications
        </button>
        <div className="mx-2 my-1 h-px bg-border" />
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl px-3">
          <span className="font-medium">Pause runs</span>
          <Switch checked={pauseOn} onCheckedChange={togglePause} disabled={pausePending} aria-label="Pause automatic runs" />
        </div>
        <button
          type="button"
          className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-medium hover:bg-muted"
          onClick={() => {
            setOpen(false);
            setConfirming(true);
          }}
        >
          Run backlog now
        </button>
        {pauseMessage ? <p className="px-3 py-1 text-sm text-primary">{pauseMessage}</p> : null}
        {pauseError ? <p className="px-3 py-1 text-sm text-destructive" role="alert">{pauseError}</p> : null}
        {runMessage ? <p className="px-3 py-1 text-sm text-primary" role="status">{runMessage}</p> : null}
        {runError ? <p className="px-3 py-1 text-sm text-destructive" role="alert">{runError}</p> : null}
        <div className="mx-2 my-1 h-px bg-border" />
        <button type="button" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-medium hover:bg-muted" onClick={() => router.refresh()}>
          Refresh
        </button>
        {passwordProtected ? (
          <form action="/api/logout" method="post">
            <button type="submit" className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-medium hover:bg-muted">
              Sign out
            </button>
          </form>
        ) : null}
      </nav>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run the backlog now?</DialogTitle>
            <DialogDescription>
              {webhookReady
                ? "This starts your ZipRecruiter backlog routine. It can take a few minutes. You can leave this page after it starts."
                : "This button is not connected yet. Add WEBHOOK_URL and WEBHOOK_KEY on the server, then try again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-10" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" className="h-10" disabled={!webhookReady || running} onClick={runBacklog}>
              {running ? "Starting…" : "Run now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

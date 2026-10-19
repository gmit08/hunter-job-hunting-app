"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson, SignInRequired } from "@/components/api-client";
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

export function ControlBar({ paused, webhookReady }: { paused: boolean; webhookReady: boolean }) {
  const router = useRouter();
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
    } catch (error) {
      if (error instanceof SignInRequired) {
        router.push("/login");
        return;
      }
      setRunError(error instanceof Error ? error.message : "The routine did not start.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Pause automatic runs</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {pauseOn
                ? "On. Your assistant will skip the ZipRecruiter backlog until you turn this off."
                : "Off. Your assistant can run the ZipRecruiter backlog on its next check."}
            </p>
          </div>
          <Switch
            checked={pauseOn}
            onCheckedChange={togglePause}
            disabled={pausePending}
            aria-label="Pause automatic runs"
          />
        </div>
        {pauseMessage ? <p className="mt-3 text-sm text-primary">{pauseMessage}</p> : null}
        {pauseError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {pauseError}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <h2 className="font-medium">ZipRecruiter backlog</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Start the backlog routine now. The address and key stay on the server.
        </p>
        <Button type="button" className="mt-4 h-11 px-4" onClick={() => setConfirming(true)}>
          Run backlog now
        </Button>
        {runMessage ? (
          <p className="mt-3 text-sm text-primary" role="status">
            {runMessage}
          </p>
        ) : null}
        {runError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {runError}
          </p>
        ) : null}
      </section>

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
    </div>
  );
}

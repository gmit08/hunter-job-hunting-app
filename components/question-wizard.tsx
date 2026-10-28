"use client";

import { useEffect, useId, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatShortDate, isDoneStatus, isOpenStatus, type Question } from "@/lib/applications";
import {
  buildWizardOrder,
  cursorAfterSave,
  cursorAfterSkip,
  enterInsertsNewline,
  initialCursor,
  noteSaved,
  noteSkipped,
  previousIndex,
  usesCoarsePointer,
} from "@/lib/question-stack";
import { postJson, SignInRequired } from "@/components/api-client";
import { Button } from "@/components/ui/button";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const THREE_DAY_CHECK_LABEL = "Run 3-day check: drop questions for closed jobs";

function ThreeDayCheckButton({ checking, onCheck }: { checking: boolean; onCheck: () => void }) {
  const panelId = useId();
  const [confirming, setConfirming] = useState(false);
  const locked = useRef(false);

  useEffect(() => {
    if (!checking) locked.current = false;
  }, [checking]);

  useEffect(() => {
    if (!confirming) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setConfirming(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming]);

  function run() {
    if (locked.current || checking) return;
    locked.current = true;
    setConfirming(false);
    onCheck();
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
        aria-label={checking ? "Running 3-day check" : THREE_DAY_CHECK_LABEL}
        title={THREE_DAY_CHECK_LABEL}
        aria-expanded={confirming}
        aria-controls={panelId}
        aria-busy={checking}
        disabled={checking}
        onClick={() => setConfirming((open) => !open)}
      >
        <RefreshCw className={checking ? "size-5 animate-spin motion-reduce:animate-none" : "size-5"} aria-hidden="true" />
      </button>
      {confirming && !checking ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Confirm 3-day check"
          className="absolute top-full right-0 z-20 mt-2 w-56 rounded-2xl bg-card p-3 text-sm shadow-lg ring-1 ring-foreground/10"
        >
          <p className="leading-5 text-muted-foreground">Drop questions for jobs that are no longer posted?</p>
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={run}
            >
              Run check
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RemainingHeader({
  count,
  large,
  checking,
  onCheck,
}: {
  count: number;
  large?: boolean;
  checking: boolean;
  onCheck: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p
        className={`min-w-0 font-heading leading-none font-medium tracking-tight whitespace-nowrap ${
          large ? "text-4xl lg:text-5xl" : "text-4xl"
        }`}
      >
        {count}{" "}
        <span className="font-sans text-xl font-medium text-muted-foreground">remaining</span>
      </p>
      <ThreeDayCheckButton checking={checking} onCheck={onCheck} />
    </div>
  );
}

function questionParts(text: string): { type: "text" | "link"; value: string }[] {
  const parts: { type: "text" | "link"; value: string }[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const value = raw.replace(/[),.;]+$/, "");
    if (index > last) parts.push({ type: "text", value: text.slice(last, index) });
    parts.push({ type: "link", value });
    last = index + raw.length - (raw.length - value.length);
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  if (parts.length === 0) parts.push({ type: "text", value: text });
  return parts;
}

export function QuestionWizard({
  questions,
  sending,
  onSend,
  checking,
  onCheck,
}: {
  questions: Question[];
  sending: boolean;
  onSend: () => void;
  checking: boolean;
  onCheck: () => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [localAnswers, setLocalAnswers] = useState<Record<number, string>>({});
  const [localStatus, setLocalStatus] = useState<Record<number, string>>({});
  const [sessionSaved, setSessionSaved] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [cursorOverride, setCursorOverride] = useState<number | "complete" | null>(null);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [error, setError] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const previousFocus = useRef<number | null>(null);

  function statusOf(question: Question): string {
    if (isDoneStatus(question.status)) return question.status;
    return localStatus[question.row] ?? question.status;
  }

  function answerOf(question: Question): string {
    if (isDoneStatus(question.status)) return question.answer;
    if (localAnswers[question.row] !== undefined) return localAnswers[question.row];
    return question.answer;
  }

  const sheetRows = questions.map((question) => {
    const status = statusOf(question);
    return {
      row: question.row,
      editable: !isDoneStatus(status),
      open: isOpenStatus(status),
    };
  });
  const openRows = new Set(sheetRows.filter((row) => row.open).map((row) => row.row));
  const order = buildWizardOrder({ sheetRows, sessionSaved, skipped });
  let cursor = cursorOverride;
  if (typeof cursor === "number" && !order.includes(cursor)) cursor = null;
  if (cursor == null) cursor = initialCursor(order, openRows) ?? "complete";
  const current = typeof cursor === "number" ? questions.find((question) => question.row === cursor) : undefined;
  const backIndex = previousIndex(order, current ? current.row : "complete");

  useEffect(() => {
    if (!current) return;
    if (previousFocus.current !== null && previousFocus.current !== current.row) {
      areaRef.current?.focus();
    }
    previousFocus.current = current.row;
  }, [current]);

  function textFor(question: Question): string {
    if (drafts[question.row] !== undefined) return drafts[question.row];
    return answerOf(question);
  }

  async function submit(question: Question) {
    if (savingRow !== null) return;
    const answer = textFor(question).trim();
    setError("");
    if (!answer) {
      setError("Type an answer first.");
      return;
    }
    setSavingRow(question.row);
    try {
      await postJson<{ message: string }>("/api/questions", {
        row: question.row,
        question: question.question,
        answer,
      });
      const nextSession = noteSaved(sessionSaved, question.row);
      const nextSkipped = skipped.filter((row) => row !== question.row);
      const nextSheet = sheetRows.map((row) =>
        row.row === question.row ? { ...row, open: false, editable: true } : row,
      );
      const nextOrder = buildWizardOrder({
        sheetRows: nextSheet,
        sessionSaved: nextSession,
        skipped: nextSkipped,
      });
      const nextOpen = new Set([...openRows].filter((row) => row !== question.row));
      setDrafts((existing) => {
        const next = { ...existing };
        delete next[question.row];
        return next;
      });
      setLocalAnswers((existing) => ({ ...existing, [question.row]: answer }));
      setLocalStatus((existing) => ({ ...existing, [question.row]: "Answered" }));
      setSessionSaved(nextSession);
      setSkipped(nextSkipped);
      setCursorOverride(cursorAfterSave(nextOrder, question.row, nextOpen));
      router.refresh();
    } catch (caught) {
      if (caught instanceof SignInRequired) {
        router.push("/login");
        return;
      }
      setError(caught instanceof Error ? caught.message : "The answer did not save.");
    } finally {
      setSavingRow(null);
    }
  }

  function skip(question: Question) {
    if (savingRow !== null || !isOpenStatus(statusOf(question))) return;
    setError("");
    const nextSkipped = noteSkipped(skipped, question.row);
    const nextOrder = buildWizardOrder({ sheetRows, sessionSaved, skipped: nextSkipped });
    setSkipped(nextSkipped);
    setCursorOverride(cursorAfterSkip(order, nextOrder, question.row, openRows));
  }

  function back() {
    if (backIndex == null || savingRow !== null) return;
    setError("");
    setCursorOverride(order[backIndex]);
  }

  if (!current) {
    return (
      <section id="questions" className="scroll-mt-24 px-4 pt-5 lg:px-0 lg:pt-8">
        <RemainingHeader count={0} checking={checking} onCheck={onCheck} />
        <p className="mt-2 text-sm text-muted-foreground">The last card is answered.</p>
        <article className="mt-5 rounded-3xl bg-card p-6 ring-1 ring-foreground/10">
          <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5 9.2 17 19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="mt-4 font-heading text-3xl leading-none font-medium tracking-tight">Send all answers now</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Saved answers are already in the sheet. This asks your assistant to submit them now, instead of waiting for the next run.
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-12 bg-muted px-5 text-muted-foreground"
              disabled={backIndex == null || sending}
              onClick={back}
            >
              Back
            </Button>
            <Button type="button" className="h-12 flex-1 text-base" disabled={sending} onClick={onSend}>
              {sending ? "Sending…" : "Send all answers now"}
            </Button>
          </div>
        </article>
      </section>
    );
  }

  const saving = savingRow === current.row;
  const openCard = isOpenStatus(statusOf(current));
  const shown = textFor(current);

  return (
    <section id="questions" className="scroll-mt-24 px-4 pt-5 lg:px-0 lg:pt-8">
      <RemainingHeader count={openRows.size} large checking={checking} onCheck={onCheck} />

      <div className="relative mt-5 pb-6">
        {order.length > 2 ? <div className="absolute inset-x-5 top-5 bottom-0 rounded-3xl bg-muted ring-1 ring-foreground/10" /> : null}
        {order.length > 1 ? <div className="absolute inset-x-2.5 top-2.5 bottom-2 rounded-3xl bg-card ring-1 ring-foreground/10" /> : null}
        <article key={current.row} className="hunter-card relative rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
          <p className="text-xs text-muted-foreground">{formatShortDate(current.date)}</p>
          <h2 className="mt-2 font-heading text-3xl leading-tight font-medium tracking-tight">
            {current.job || "A job"}
          </h2>
          <p className="mt-4 text-base leading-7">
            {questionParts(current.question).map((part, index) =>
              part.type === "link" ? (
                <a key={index} className="underline underline-offset-2" href={part.value} target="_blank" rel="noopener noreferrer">
                  {part.value}
                </a>
              ) : (
                <span key={index}>{part.value}</span>
              ),
            )}
          </p>
          <label className="mt-4 block">
            <span className="sr-only">Answer for {current.job || "this question"}</span>
            <textarea
              ref={areaRef}
              value={shown}
              onChange={(event) => setDrafts((existing) => ({ ...existing, [current.row]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
                if (enterInsertsNewline(usesCoarsePointer(), event.shiftKey)) return;
                if (event.repeat) return;
                event.preventDefault();
                void submit(current);
              }}
              placeholder="Type an answer"
              disabled={saving}
              className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
            />
          </label>
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-12 shrink-0 bg-muted px-4 text-muted-foreground"
              disabled={saving || backIndex == null}
              onClick={back}
            >
              Back
            </Button>
            <div className="wizard-touch-actions gap-2">
              <Button type="button" className="h-12 min-w-0 flex-1 text-base" disabled={saving} onClick={() => submit(current)}>
                {saving ? "Saving…" : "Next"}
              </Button>
              {openCard ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-12 bg-muted px-5 text-muted-foreground"
                  disabled={saving}
                  onClick={() => skip(current)}
                >
                  Skip
                </Button>
              ) : null}
            </div>
          </div>
          <p className="wizard-touch-hint mt-2 text-xs text-muted-foreground">
            Next saves this card. Return starts a new line.{openCard ? " Skip keeps it for later." : ""}
          </p>
          <p className="wizard-desktop-hint mt-2 items-center gap-3 text-xs text-muted-foreground">
            <span>Enter sends this card · Shift+Enter for a new line</span>
            {openCard ? (
              <button
                type="button"
                className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                disabled={saving}
                onClick={() => skip(current)}
              >
                Skip
              </button>
            ) : null}
          </p>
        </article>
      </div>
    </section>
  );
}

export function AnsweredQuestions({ questions }: { questions: Question[] }) {
  const [open, setOpen] = useState(false);
  const sent = questions.filter((question) => isDoneStatus(question.status));
  if (sent.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} {sent.length} already sent
      </button>
      {open ? (
        <div className="mt-3 grid gap-3">
          {sent.map((question) => (
            <article key={question.row} className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
              <p className="text-xs text-muted-foreground">{formatShortDate(question.date)}</p>
              <p className="mt-1 font-medium">{question.job || "A job"}</p>
              <p className="mt-1 text-muted-foreground">{question.question}</p>
              <p className="mt-2 whitespace-pre-wrap">{question.answer || "No answer text."}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

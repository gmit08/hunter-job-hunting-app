"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatShortDate, isOpenStatus, type Question } from "@/lib/applications";
import { postJson, SignInRequired } from "@/components/api-client";
import { Button } from "@/components/ui/button";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;

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
}: {
  questions: Question[];
  sending: boolean;
  onSend: () => void;
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [answeredRows, setAnsweredRows] = useState<number[]>([]);
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [error, setError] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const previousRow = useRef<number | null>(null);

  const remaining = questions.filter(
    (question) => isOpenStatus(question.status) && !answeredRows.includes(question.row),
  );
  const current = remaining[0];

  useEffect(() => {
    if (!current) return;
    if (previousRow.current !== null && previousRow.current !== current.row) {
      areaRef.current?.focus();
    }
    previousRow.current = current.row;
  }, [current]);

  async function submit(question: Question) {
    if (savingRow !== null) return;
    const answer = (drafts[question.row] ?? "").trim();
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
      setDrafts((existing) => ({ ...existing, [question.row]: "" }));
      setAnsweredRows((existing) => [...existing, question.row]);
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

  if (!current) {
    return (
      <section id="questions" className="scroll-mt-24 px-4 pt-5 lg:px-0 lg:pt-8">
        <p className="font-heading text-4xl leading-none font-medium tracking-tight">
          0 <span className="font-sans text-xl font-medium text-muted-foreground">remaining</span>
        </p>
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
          <Button type="button" className="mt-5 h-12 w-full text-base" disabled={sending} onClick={onSend}>
            {sending ? "Sending…" : "Send all answers now"}
          </Button>
        </article>
      </section>
    );
  }

  const saving = savingRow === current.row;

  return (
    <section id="questions" className="scroll-mt-24 px-4 pt-5 lg:px-0 lg:pt-8">
      <p className="font-heading text-4xl leading-none font-medium tracking-tight lg:text-5xl">
        {remaining.length}{" "}
        <span className="font-sans text-xl font-medium text-muted-foreground">remaining</span>
      </p>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">Only this card is active.</p>

      <div className="relative mt-5 pb-6">
        {remaining.length > 2 ? <div className="absolute inset-x-5 top-5 bottom-0 rounded-3xl bg-muted ring-1 ring-foreground/10" /> : null}
        {remaining.length > 1 ? <div className="absolute inset-x-2.5 top-2.5 bottom-2 rounded-3xl bg-card ring-1 ring-foreground/10" /> : null}
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
              value={drafts[current.row] ?? ""}
              onChange={(event) => setDrafts((existing) => ({ ...existing, [current.row]: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.shiftKey || event.repeat || event.nativeEvent.isComposing) return;
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
          <Button type="button" className="mt-3 h-12 w-full text-base lg:hidden" disabled={saving} onClick={() => submit(current)}>
            {saving ? "Saving…" : "Next"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground lg:hidden">Next saves this card.</p>
          <p className="mt-2 hidden text-xs text-muted-foreground lg:block">Enter sends this card · Shift+Enter for a new line</p>
        </article>
      </div>
    </section>
  );
}

export function AnsweredQuestions({ questions }: { questions: Question[] }) {
  const [open, setOpen] = useState(false);
  const handled = questions.filter((question) => !isOpenStatus(question.status));
  if (handled.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        {open ? "Hide" : "Show"} {handled.length} already answered
      </button>
      {open ? (
        <div className="mt-3 grid gap-3">
          {handled.map((question) => (
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

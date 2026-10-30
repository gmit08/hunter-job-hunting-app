"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatShortDate, isDoneStatus, isOpenStatus, type Application, type Question } from "@/lib/applications";
import {
  cursorAfterSave,
  cursorAfterSkip,
  enterInsertsNewline,
  initialCursor,
  noteSaved,
  noteSkipped,
  previousIndex,
  usesCoarsePointer,
} from "@/lib/question-stack";
import {
  QUESTION_SORTS,
  orderQuestionRows,
  readSessionQuestionSort,
  scoresForJob,
  writeSessionQuestionSort,
  type QuestionSort,
  type RankedQuestion,
} from "@/lib/question-sort";
import { postJson, SignInRequired } from "@/components/api-client";
import { SourcePill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { APPLY_LINK_LABEL, presentQuestionText } from "@/lib/display-text";
import { THREE_DAY_CHECK_WORKING_TOAST } from "@/lib/three-day-check";

const THREE_DAY_CHECK_LABEL = "Run 3-day check: drop questions for closed jobs";

function DisplayCopy({ text, link }: { text: string; link?: string }) {
  const display = presentQuestionText(text, link);
  return (
    <>
      {display.text}
      {display.applyHref ? (
        <a
          href={display.applyHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block w-fit max-w-full min-w-0 font-medium break-all text-primary underline underline-offset-2 [overflow-wrap:anywhere]"
        >
          {APPLY_LINK_LABEL}
        </a>
      ) : null}
    </>
  );
}

function ThreeDayCheckButton({ checking, onCheck }: { checking: boolean; onCheck: () => void }) {
  const locked = useRef(false);

  useEffect(() => {
    if (!checking) locked.current = false;
  }, [checking]);

  return (
    <button
      type="button"
      className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
      aria-label={checking ? THREE_DAY_CHECK_WORKING_TOAST : THREE_DAY_CHECK_LABEL}
      aria-busy={checking}
      disabled={checking}
      onClick={() => {
        if (locked.current || checking) return;
        locked.current = true;
        onCheck();
      }}
    >
      <RefreshCw className={checking ? "size-5 animate-spin motion-reduce:animate-none" : "size-5"} aria-hidden="true" />
    </button>
  );
}

function QuestionSortMenu({ sort, onChange }: { sort: QuestionSort; onChange: (sort: QuestionSort) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = QUESTION_SORTS.find((item) => item.id === sort) ?? QUESTION_SORTS[0];

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative ml-auto min-w-0">
      <button
        type="button"
        className="flex h-9 max-w-full min-w-0 items-center gap-1 rounded-full bg-card px-3 text-left text-sm ring-1 ring-foreground/10"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sort questions, ${current.label}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="truncate">{current.label}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="Sort questions"
          className="absolute right-0 z-30 mt-1 w-max max-w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-card p-1 text-sm shadow-lg ring-1 ring-foreground/10"
        >
          {QUESTION_SORTS.map((item) => (
            <li key={item.id} role="option" aria-selected={item.id === sort}>
              <button
                type="button"
                className={`block w-full rounded-xl px-3 py-2 text-left ${item.id === sort ? "bg-muted font-medium" : "hover:bg-muted"}`}
                onClick={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function RemainingHeader({
  count,
  large,
  checking,
  onCheck,
  sort,
  onSort,
}: {
  count: number;
  large?: boolean;
  checking: boolean;
  onCheck: () => void;
  sort: QuestionSort;
  onSort: (sort: QuestionSort) => void;
}) {
  return (
    <div className="relative z-20 flex w-full min-w-0 flex-wrap items-center gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <p
          className={`min-w-0 font-heading leading-none font-medium tracking-tight ${
            large ? "text-4xl lg:text-5xl" : "text-4xl"
          }`}
        >
          {count}{" "}
          <span className="font-sans text-xl font-medium text-muted-foreground">remaining</span>
        </p>
        <ThreeDayCheckButton checking={checking} onCheck={onCheck} />
      </div>
      <QuestionSortMenu sort={sort} onChange={onSort} />
    </div>
  );
}

export function QuestionWizard({
  questions,
  applications,
  sending,
  onSend,
  checking,
  onCheck,
}: {
  questions: Question[];
  applications: Application[];
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
  const [sort, setSort] = useState<QuestionSort>("newest");
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

  useEffect(() => {
    setSort(readSessionQuestionSort());
  }, []);

  function rankedQuestions(closedRow?: number): RankedQuestion[] {
    return questions.map((question) => {
      const status = closedRow === question.row ? "Answered" : statusOf(question);
      const scores = scoresForJob(question.job, applications);
      return {
        row: question.row,
        date: question.date,
        score: scores.score,
        matchScore: scores.matchScore,
        editable: !isDoneStatus(status),
        open: isOpenStatus(status),
      };
    });
  }

  function orderedRows(nextSession: number[], nextSkipped: number[], closedRow?: number): number[] {
    return orderQuestionRows({
      questions: rankedQuestions(closedRow),
      sort,
      sessionSaved: nextSession,
      skipped: nextSkipped,
    });
  }

  function chooseSort(next: QuestionSort) {
    setSort(next);
    writeSessionQuestionSort(next);
    setCursorOverride(null);
  }

  const ranked = rankedQuestions();
  const openRows = new Set(ranked.filter((row) => row.open).map((row) => row.row));
  const order = orderedRows(sessionSaved, skipped);
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
      const nextOrder = orderedRows(nextSession, nextSkipped, question.row);
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
    const nextOrder = orderedRows(sessionSaved, nextSkipped);
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
      <section id="questions" className="scroll-mt-24 min-w-0 max-w-full overflow-x-hidden px-4 pt-5 lg:px-6 lg:pt-8">
        <RemainingHeader count={0} checking={checking} onCheck={onCheck} sort={sort} onSort={chooseSort} />
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
    <section id="questions" className="scroll-mt-24 min-w-0 max-w-full overflow-x-hidden px-4 pt-5 lg:px-6 lg:pt-8">
      <RemainingHeader count={openRows.size} large checking={checking} onCheck={onCheck} sort={sort} onSort={chooseSort} />

      <div className="relative mt-5 min-w-0 max-w-full pb-6">
        {order.length > 2 ? <div className="absolute inset-x-5 top-5 bottom-0 rounded-3xl bg-muted ring-1 ring-foreground/10" /> : null}
        {order.length > 1 ? <div className="absolute inset-x-2.5 top-2.5 bottom-2 rounded-3xl bg-card ring-1 ring-foreground/10" /> : null}
        <article key={current.row} className="hunter-card relative min-w-0 overflow-hidden rounded-3xl bg-card p-5 ring-1 ring-foreground/10">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-xs text-muted-foreground">{formatShortDate(current.date)}</p>
            <SourcePill source={current.source} />
          </div>
          <h2 className="question-copy mt-2 font-heading text-3xl leading-tight font-medium tracking-tight">
            {current.job || "A job"}
          </h2>
          <div className="question-copy mt-4 min-w-0 max-w-full text-base leading-7">
            <DisplayCopy text={current.question} link={current.link} />
          </div>
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
            <article key={question.row} className="min-w-0 overflow-hidden rounded-2xl bg-muted/60 px-4 py-3 text-sm">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{formatShortDate(question.date)}</p>
                <SourcePill source={question.source} />
              </div>
              <p className="mt-1 break-words font-medium [overflow-wrap:anywhere]">{question.job || "A job"}</p>
              <div className="question-copy mt-1 min-w-0 max-w-full text-muted-foreground">
                <DisplayCopy text={question.question} link={question.link} />
              </div>
              <p className="mt-2 break-words whitespace-pre-wrap [overflow-wrap:anywhere]">
                <DisplayCopy text={question.answer || "No answer text."} />
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatShortDate, isOpenStatus, type Question } from "@/lib/applications";
import { postJson, SignInRequired } from "@/components/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function QuestionsPanel({ questions }: { questions: Question[] }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingRow, setSavingRow] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showHandled, setShowHandled] = useState(false);

  const open = questions.filter((question) => isOpenStatus(question.status));
  const handled = questions.filter((question) => !isOpenStatus(question.status));

  async function submit(question: Question) {
    const answer = (drafts[question.row] ?? "").trim();
    setNotice("");
    setError("");
    if (!answer) {
      setError("Type an answer first.");
      return;
    }
    setSavingRow(question.row);
    try {
      const result = await postJson<{ message: string }>("/api/questions", {
        row: question.row,
        question: question.question,
        answer,
      });
      setDrafts((current) => ({ ...current, [question.row]: "" }));
      setNotice(result.message);
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

  return (
    <section id="questions" className="scroll-mt-24">
      <h2 className="font-heading text-2xl font-medium">Questions for you</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
        Your assistant leaves questions here. Type an answer and it will be picked up on the next run.
      </p>

      {notice ? (
        <p className="mt-4 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {open.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-card px-4 py-5 text-sm ring-1 ring-foreground/10">Nothing is waiting on you.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {open.map((question) => (
            <article key={question.row} className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
              <p className="text-xs text-muted-foreground">{formatShortDate(question.date)}</p>
              <h3 className="mt-1 font-medium">{question.job || "A job"}</h3>
              <p className="mt-2 text-sm leading-6">{question.question}</p>
              <label className="mt-3 block">
                <span className="sr-only">Answer for {question.job || "this question"}</span>
                <Textarea
                  value={drafts[question.row] ?? ""}
                  onChange={(event) => setDrafts((current) => ({ ...current, [question.row]: event.target.value }))}
                  placeholder="Type your answer"
                  className="min-h-24 text-base"
                />
              </label>
              <Button
                type="button"
                className="mt-3 h-11 px-4"
                disabled={savingRow === question.row}
                onClick={() => submit(question)}
              >
                {savingRow === question.row ? "Saving…" : "Save answer"}
              </Button>
            </article>
          ))}
        </div>
      )}

      {handled.length > 0 ? (
        <div className="mt-4">
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setShowHandled((current) => !current)}
            aria-expanded={showHandled}
          >
            {showHandled ? "Hide" : "Show"} {handled.length} already answered
          </button>
          {showHandled ? (
            <div className="mt-3 grid gap-3">
              {handled.map((question) => (
                <article key={question.row} className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                  <p className="font-medium">{question.job || "A job"}</p>
                  <p className="mt-1 text-muted-foreground">{question.question}</p>
                  <p className="mt-2 whitespace-pre-wrap">{question.answer || "No answer text."}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

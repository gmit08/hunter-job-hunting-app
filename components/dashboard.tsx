"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatShortDate, type Application } from "@/lib/applications";
import type { DashboardData } from "@/lib/mock-data";
import { AnsweredQuestions, QuestionWizard } from "@/components/question-wizard";
import { AppMenu } from "@/components/app-menu";
import { ApplicationBrowser } from "@/components/application-browser";
import { ApplicationDetail } from "@/components/application-detail";
import { postJson, SignInRequired } from "@/components/api-client";
import { formatScore, statusColor, StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { isOpenStatus } from "@/lib/applications";

export function Dashboard({
  data,
  passwordProtected,
}: {
  data: DashboardData;
  passwordProtected: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Application | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const highest = data.summary.top[0];
  const showSetup = data.source !== "sheet" || !passwordProtected || !data.webhookReady;
  const openCount = data.questions.filter((question) => isOpenStatus(question.status)).length;

  function showToast(next: { ok: boolean; message: string }) {
    setToast(next);
    window.setTimeout(() => setToast((current) => (current === next ? null : current)), 4500);
  }

  async function sendAnswers() {
    if (sending) return;
    setSending(true);
    try {
      const result = await postJson<{ message: string }>("/api/answers", {});
      showToast({ ok: true, message: result.message });
    } catch (caught) {
      if (caught instanceof SignInRequired) {
        router.push("/login");
        return;
      }
      showToast({
        ok: false,
        message: caught instanceof Error ? caught.message : "Your assistant was not notified.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-full">
      <AppMenu
        paused={data.paused}
        webhookReady={data.webhookReady}
        passwordProtected={passwordProtected}
        openCount={openCount}
      />

      <div className="mx-auto w-full max-w-6xl lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.75fr)] lg:items-start lg:gap-10 lg:px-6">
        <div className="min-h-dvh lg:min-h-0">
          {data.source === "error" ? (
            <div className="px-4 pt-5 lg:px-0 lg:pt-8">
              <ErrorBanner data={data} onRetry={() => router.refresh()} />
            </div>
          ) : (
            <QuestionWizard questions={data.questions} sending={sending} onSend={sendAnswers} />
          )}
        </div>

        <main className="flex flex-col gap-8 px-4 py-8 sm:px-6 lg:px-0 lg:py-8">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Updated {data.fetchedAt}.</p>
          {showSetup ? <SetupBanner data={data} passwordProtected={passwordProtected} /> : null}
          {data.source !== "error" && data.paused ? (
            <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary">
              Automatic runs are paused. Your assistant will skip the backlog until you turn the switch off.
            </p>
          ) : null}

          {data.source === "error" ? null : (
            <>
              <section id="overview" className="scroll-mt-24">
              <h2 className="font-heading text-2xl font-medium">Overview</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Applications" value={String(data.summary.total)} detail="In the tracker" />
                <Stat
                  label="This week"
                  value={String(data.summary.thisWeek)}
                  detail={`Since ${formatShortDate(data.summary.weekStart)}`}
                />
                <Stat
                  label="Average score"
                  value={formatScore(data.summary.averageScore)}
                  detail={
                    data.summary.scoredCount
                      ? `Across ${data.summary.scoredCount} scored`
                      : "No desirability scores yet"
                  }
                />
                <Stat
                  label="Highest score"
                  value={formatScore(highest?.score)}
                  detail={highest ? highest.company : "No scored jobs yet"}
                />
              </div>

              <div className="mt-4 grid gap-3">
                <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
                  <h3 className="font-medium">Status</h3>
                  {data.summary.statuses.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">Statuses will show up once applications are in the sheet.</p>
                  ) : (
                    <>
                      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-muted">
                        {data.summary.statuses.map((item) => (
                          <div
                            key={item.status}
                            style={{
                              width: `${(item.count / data.summary.total) * 100}%`,
                              backgroundColor: statusColor(item.status),
                            }}
                            title={`${item.status}: ${item.count}`}
                          />
                        ))}
                      </div>
                      <ul className="mt-4 grid gap-2">
                        {data.summary.statuses.map((item) => (
                          <li key={item.status} className="flex items-center justify-between gap-3 text-sm">
                            <StatusPill status={item.status} />
                            <span className="tabular-nums text-muted-foreground">{item.count}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </article>

                <article className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
                  <h3 className="font-medium">Top scored jobs</h3>
                  {data.summary.top.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Scores will show up here once desirability scores are filled in.
                    </p>
                  ) : (
                    <ul className="mt-2">
                      {data.summary.top.map((job) => (
                        <li key={job.row}>
                          <button
                            type="button"
                            onClick={() => setSelected(job)}
                            className="flex w-full items-start justify-between gap-3 rounded-xl px-1 py-2 text-left hover:bg-muted"
                          >
                            <span>
                              <span className="block font-medium">{job.company}</span>
                              <span className="block text-sm text-muted-foreground">{job.role}</span>
                            </span>
                            <span className="font-heading text-2xl leading-none tabular-nums">{formatScore(job.score)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              </div>

              {data.scoring.length > 0 ? (
                <details className="mt-4 rounded-2xl bg-card px-4 py-3 ring-1 ring-foreground/10 sm:px-5">
                  <summary className="cursor-pointer font-medium">How scores are calculated</summary>
                  <dl className="mt-4 grid gap-3">
                    {data.scoring.map((rule) => (
                      <div key={rule.label}>
                        <dt className="text-sm font-medium">{rule.label}</dt>
                        <dd className="text-sm leading-6 text-muted-foreground">{rule.value}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null}
            </section>

              <AnsweredQuestions questions={data.questions} />
            </>
          )}
        </main>
      </div>

      {data.source === "error" ? null : (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-2 sm:px-6">
          <ApplicationBrowser applications={data.applications} onSelect={setSelected} />
          <ApplicationDetail application={selected} onClose={() => setSelected(null)} />
        </div>
      )}

      <footer className="mx-auto w-full max-w-6xl border-t px-4 py-4 text-xs leading-5 text-muted-foreground sm:px-6">
          {data.source === "sheet" ? (
            <p>
              Reading your spreadsheet
              {data.serviceAccountEmail ? ` as ${data.serviceAccountEmail}` : ""}.{" "}
              {data.spreadsheetUrl ? (
                <a className="text-primary underline underline-offset-2" href={data.spreadsheetUrl} target="_blank" rel="noopener noreferrer">
                  Open the spreadsheet
                </a>
              ) : null}
            </p>
          ) : (
            <p>Sample applications stay in this running preview. They are not written to your spreadsheet.</p>
          )}
      </footer>

      <Button
        type="button"
        className="fixed right-6 bottom-6 z-30 hidden h-11 rounded-full px-4 shadow-lg lg:inline-flex"
        disabled={sending || data.source === "error"}
        onClick={sendAnswers}
      >
        {sending ? "Sending…" : "Send all answers now"}
      </Button>

      {toast ? (
        <p
          role="status"
          className={`fixed top-20 left-1/2 z-50 w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 rounded-2xl px-4 py-3 text-sm shadow-lg ring-1 ${
            toast.ok ? "bg-card text-primary ring-primary/20" : "bg-card text-destructive ring-destructive/20"
          }`}
        >
          {toast.message}
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl bg-card px-4 py-4 ring-1 ring-foreground/10">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 font-heading text-4xl leading-none font-medium tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function SetupBanner({ data, passwordProtected }: { data: DashboardData; passwordProtected: boolean }) {
  const items = [
    data.source === "sample"
      ? "Connect the Google Sheet to replace these sample jobs with your real applications."
      : data.source === "error"
        ? "The spreadsheet could not be read. The note below explains what to fix."
        : "",
    passwordProtected ? "" : "Set DASHBOARD_PASSWORD before you share this link. Right now anyone with the link can open it.",
    data.webhookReady ? "" : "Add WEBHOOK_URL and WEBHOOK_KEY so Run backlog now can start a run.",
  ].filter(Boolean);

  if (!items.length) return null;

  return (
    <section className="rounded-2xl border border-amber-700/20 bg-amber-100/70 px-4 py-4 text-sm text-amber-950">
      <h2 className="font-medium">Before you rely on this page</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ErrorBanner({ data, onRetry }: { data: DashboardData; onRetry: () => void }) {
  return (
    <section className="rounded-2xl bg-destructive/10 px-4 py-4 text-sm" role="alert">
      <h2 className="font-medium text-destructive">The spreadsheet could not be read</h2>
      <p className="mt-2 leading-6 text-foreground">{data.message}</p>
      {data.serviceAccountEmail ? (
        <p className="mt-2 leading-6">
          Share the sheet with <span className="font-medium">{data.serviceAccountEmail}</span> as an Editor.
        </p>
      ) : null}
      <Button type="button" variant="outline" className="mt-4 h-10 bg-card" onClick={onRetry}>
        Try again
      </Button>
    </section>
  );
}

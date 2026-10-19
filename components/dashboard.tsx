"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatShortDate, type Application } from "@/lib/applications";
import type { DashboardData } from "@/lib/mock-data";
import { ApplicationBrowser } from "@/components/application-browser";
import { ApplicationDetail } from "@/components/application-detail";
import { ControlBar } from "@/components/control-bar";
import { QuestionsPanel } from "@/components/questions-panel";
import { formatScore, statusColor, StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";

export function Dashboard({
  data,
  passwordProtected,
}: {
  data: DashboardData;
  passwordProtected: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Application | null>(null);
  const highest = data.summary.top[0];
  const showSetup = data.source !== "sheet" || !passwordProtected || !data.webhookReady;

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium tracking-[0.18em] text-primary uppercase">Dashboard</p>
              <h1 className="mt-1 font-heading text-3xl leading-none font-medium tracking-tight sm:text-4xl">
                Job search
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" className="h-10 px-3" onClick={() => router.refresh()}>
                Refresh
              </Button>
              {passwordProtected ? (
                <form action="/api/logout" method="post">
                  <Button type="submit" variant="ghost" className="h-10 px-3">
                    Sign out
                  </Button>
                </form>
              ) : null}
            </div>
          </div>
          <nav className="flex gap-4 text-sm">
            <a className="text-muted-foreground hover:text-foreground" href="#overview">
              Overview
            </a>
            <a className="text-muted-foreground hover:text-foreground" href="#questions">
              Questions
            </a>
            <a className="text-muted-foreground hover:text-foreground" href="#applications">
              Applications
            </a>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Your applications, scores, and questions in one place. Updated {data.fetchedAt}.
        </p>

        {showSetup ? <SetupBanner data={data} passwordProtected={passwordProtected} /> : null}
        {data.source === "error" ? <ErrorBanner data={data} onRetry={() => router.refresh()} /> : null}
        {data.source !== "error" && data.paused ? (
          <p className="rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary">
            Automatic runs are paused. Your assistant will skip the backlog until you turn the switch off.
          </p>
        ) : null}

        <ControlBar paused={data.paused} webhookReady={data.webhookReady} />

        {data.source === "error" ? null : (
          <>
            <section id="overview" className="scroll-mt-24">
              <h2 className="font-heading text-2xl font-medium">Overview</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
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

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
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

            <QuestionsPanel questions={data.questions} />
            <ApplicationBrowser applications={data.applications} onSelect={setSelected} />
            <ApplicationDetail application={selected} onClose={() => setSelected(null)} />
          </>
        )}

        <footer className="border-t pt-4 text-xs leading-5 text-muted-foreground">
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
      </main>
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

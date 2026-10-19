"use client";

import { useMemo, useState } from "react";
import { formatShortDate, type Application } from "@/lib/applications";
import { formatScore, StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SortKey = "date" | "company" | "role" | "status" | "score" | "match" | "remote";

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "date", label: "Date" },
  { key: "company", label: "Company" },
  { key: "role", label: "Role", className: "min-w-56" },
  { key: "status", label: "Status" },
  { key: "score", label: "Score" },
  { key: "match", label: "Match" },
  { key: "remote", label: "Remote pts" },
];

function sortValue(application: Application, key: SortKey): string | number | null {
  switch (key) {
    case "date":
      return application.dateApplied;
    case "company":
      return application.company.toLowerCase();
    case "role":
      return application.role.toLowerCase();
    case "status":
      return application.status.toLowerCase();
    case "score":
      return application.score;
    case "match":
      return application.matchScore;
    case "remote":
      return application.remotePoints;
  }
}

function compareApplications(left: Application, right: Application, key: SortKey, direction: "asc" | "desc") {
  const factor = direction === "asc" ? 1 : -1;
  const a = sortValue(left, key);
  const b = sortValue(right, key);
  const aEmpty = a == null || a === "";
  const bEmpty = b == null || b === "";
  if (aEmpty && bEmpty) return left.row - right.row;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * factor;
  return String(a).localeCompare(String(b)) * factor;
}

export function ApplicationBrowser({
  applications,
  onSelect,
}: {
  applications: Application[];
  onSelect: (application: Application) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");

  const statuses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const application of applications) {
      const label = application.status.trim() || "No status";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [applications]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return applications
      .filter((application) => {
        const label = application.status.trim() || "No status";
        if (status !== "All" && label !== status) return false;
        if (!needle) return true;
        const haystack = [application.company, application.role, application.status, application.location, ...application.fields.map((field) => field.value)]
          .join(" ")
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((left, right) => compareApplications(left, right, sortKey, direction));
  }, [applications, query, status, sortKey, direction]);

  function chooseSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setDirection(key === "company" || key === "role" || key === "status" ? "asc" : "desc");
  }

  return (
    <section id="applications" className="scroll-mt-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-medium">All applications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length} of {applications.length} shown. Select one for notes, links, and scores.
          </p>
        </div>
        <label className="block w-full sm:max-w-xs">
          <span className="sr-only">Search applications</span>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, role, notes…"
            className="h-11 px-3 text-base"
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip active={status === "All"} onClick={() => setStatus("All")} label="All" count={applications.length} />
        {statuses.map(([label, count]) => (
          <FilterChip key={label} active={status === label} onClick={() => setStatus(label)} label={label} count={count} />
        ))}
      </div>

      <label className="mt-3 block text-sm md:hidden">
        <span className="text-muted-foreground">Sort</span>
        <select
          className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3"
          value={`${sortKey}:${direction}`}
          onChange={(event) => {
            const [key, nextDirection] = event.target.value.split(":") as [SortKey, "asc" | "desc"];
            setSortKey(key);
            setDirection(nextDirection);
          }}
        >
          <option value="date:desc">Newest first</option>
          <option value="date:asc">Oldest first</option>
          <option value="score:desc">Highest score</option>
          <option value="score:asc">Lowest score</option>
          <option value="company:asc">Company A–Z</option>
          <option value="status:asc">Status A–Z</option>
        </select>
      </label>

      <div className="mt-4 grid gap-3 md:hidden">
        {visible.length === 0 ? <EmptyResults hasQuery={query.trim().length > 0 || status !== "All"} /> : null}
        {visible.map((application) => (
          <button
            key={application.row}
            type="button"
            onClick={() => onSelect(application)}
            className="rounded-2xl bg-card p-4 text-left ring-1 ring-foreground/10"
          >
            <span className="flex items-start justify-between gap-3">
              <span>
                <span className="block font-medium">{application.company}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{application.role || "Role not listed"}</span>
              </span>
              <span className="font-heading text-2xl leading-none tabular-nums">{formatScore(application.score)}</span>
            </span>
            <span className="mt-3 flex flex-wrap items-center gap-2">
              <StatusPill status={application.status} />
              <span className="text-xs text-muted-foreground">{formatShortDate(application.dateApplied)}</span>
              {application.arrangement ? <span className="text-xs text-muted-foreground">{application.arrangement}</span> : null}
              {application.cstPst ? <span className="text-xs text-muted-foreground">CST/PST {application.cstPst}</span> : null}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 hidden overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10 md:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <caption className="sr-only">All job applications</caption>
          <thead>
            <tr className="border-b text-left text-xs tracking-wide text-muted-foreground uppercase">
              {COLUMNS.map((column) => {
                const active = sortKey === column.key;
                return (
                  <th key={column.key} className={`px-3 py-3 font-medium ${column.className ?? ""}`}>
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => chooseSort(column.key)}>
                      {column.label}
                      <span aria-hidden className={active ? "text-foreground" : "text-transparent"}>
                        {direction === "asc" ? "↑" : "↓"}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="px-3 py-3 font-medium">CST/PST</th>
              <th className="px-3 py-3 font-medium">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-3 py-8">
                  <EmptyResults hasQuery={query.trim().length > 0 || status !== "All"} />
                </td>
              </tr>
            ) : null}
            {visible.map((application) => (
              <tr key={application.row} className="border-b last:border-0">
                <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{formatShortDate(application.dateApplied)}</td>
                <td className="px-3 py-3 font-medium">{application.company}</td>
                <td className="px-3 py-3">{application.role || "—"}</td>
                <td className="px-3 py-3">
                  <StatusPill status={application.status} />
                </td>
                <td className="px-3 py-3 tabular-nums">{formatScore(application.score)}</td>
                <td className="px-3 py-3 tabular-nums">{formatScore(application.matchScore)}</td>
                <td className="px-3 py-3 tabular-nums">{formatScore(application.remotePoints)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{application.cstPst || "—"}</td>
                <td className="px-3 py-3 text-right">
                  <Button type="button" variant="outline" className="h-8" onClick={() => onSelect(application)}>
                    Details
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3 text-sm ${
        active ? "bg-primary text-primary-foreground" : "bg-card text-foreground ring-1 ring-foreground/10"
      }`}
    >
      {label}
      <span className={active ? "text-primary-foreground/80" : "text-muted-foreground"}>{count}</span>
    </button>
  );
}

function EmptyResults({ hasQuery }: { hasQuery: boolean }) {
  return (
    <p className="text-sm text-muted-foreground">
      {hasQuery ? "Nothing matches that search. Try a company name or clear the status filter." : "No applications yet."}
    </p>
  );
}

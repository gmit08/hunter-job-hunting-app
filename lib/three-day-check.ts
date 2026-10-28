export const DEFAULT_COMPLETED_CELL = "Dashboard Control!B2";
export const COMPLETED_CELL_LABEL = "Last 3-day check completed";
export const THREE_DAY_CHECK_WAIT_MS = 3 * 60 * 1000;
export const THREE_DAY_CHECK_POLL_MS = 5_000;
export const THREE_DAY_CHECK_WORKING_TOAST = "Working…";
export const QUESTIONS_UPDATED_TOAST = "Questions Updated";
export const THREE_DAY_CHECK_ERROR_TOAST = "Error. Try again later.";

const ISO_TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))$/;

export type CompletedCell = {
  tab: string;
  cell: string;
};

export function parseCompletedCell(raw: string | undefined): CompletedCell | null {
  const value = raw?.trim() || DEFAULT_COMPLETED_CELL;
  const match = value.match(/^(?:'((?:[^']|'')*)'|([^'!]+))!(\$?[A-Za-z]{1,3}\$?[1-9][0-9]*)$/);
  if (!match) return null;
  const tab = (match[1] != null ? match[1].replace(/''/g, "'") : match[2]).trim();
  const cell = match[3].replace(/\$/g, "").toUpperCase();
  if (!tab || !/^[A-Z]{1,3}[1-9][0-9]*$/.test(cell)) return null;
  return { tab, cell };
}

export function parseCompletionTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 20000 || value > 80000) return null;
    return Math.round((value - 25569) * 86400 * 1000);
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!ISO_TIMESTAMP.test(text)) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function completionIsNewer(value: unknown, clickedAtMs: number): boolean {
  const completedAt = parseCompletionTimestamp(value);
  return completedAt != null && completedAt > clickedAtMs;
}

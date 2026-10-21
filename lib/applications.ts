export type Field = {
  header: string;
  value: string;
};

export type Application = {
  row: number;
  fields: Field[];
  dateApplied: string | null;
  company: string;
  role: string;
  status: string;
  score: number | null;
  matchScore: number | null;
  location: string;
  arrangement: string;
  cstPst: string;
  remotePoints: number | null;
  verificationNotes: string;
  salary: string;
  source: string;
  applicationLink: string;
  followUp: string;
};

export type Question = {
  row: number;
  date: string;
  job: string;
  question: string;
  answer: string;
  status: string;
};

export type QuestionColumns = {
  headerRow: number;
  date: number;
  job: number;
  question: number;
  answer: number;
  status: number;
};

export type ScoringRule = {
  label: string;
  value: string;
};

export type StatusCount = {
  status: string;
  count: number;
};

export type Summary = {
  total: number;
  thisWeek: number;
  weekStart: string;
  today: string;
  averageScore: number | null;
  scoredCount: number;
  top: Application[];
  statuses: StatusCount[];
};

type SemanticKey =
  | "dateApplied"
  | "company"
  | "role"
  | "status"
  | "score"
  | "matchScore"
  | "location"
  | "arrangement"
  | "cstPst"
  | "remotePoints"
  | "verificationNotes"
  | "salary"
  | "source"
  | "applicationLink"
  | "followUp";

const FIELD_TESTS: { key: SemanticKey; test: (header: string) => boolean }[] = [
  { key: "dateApplied", test: (header) => header === "date applied" || header === "date" },
  { key: "company", test: (header) => header === "company" },
  { key: "role", test: (header) => header === "job title" || header === "role" || header === "position" },
  { key: "status", test: (header) => header === "status" },
  { key: "score", test: (header) => header === "desirability score" || header === "score" },
  { key: "matchScore", test: (header) => header === "match score" },
  { key: "location", test: (header) => header === "job location" || header === "location" },
  { key: "arrangement", test: (header) => header === "work arrangement" || header === "arrangement" },
  {
    key: "cstPst",
    test: (header) => header.replace(/\s/g, "") === "cst/pst" || header === "cst" || header === "pst",
  },
  { key: "remotePoints", test: (header) => header === "remote points" },
  { key: "verificationNotes", test: (header) => header === "verification notes" },
  { key: "salary", test: (header) => header === "salary" },
  { key: "source", test: (header) => header === "source" },
  { key: "applicationLink", test: (header) => header === "application link" || header === "apply link" },
  {
    key: "followUp",
    test: (header) =>
      header === "contact / follow-up" ||
      header === "follow-up" ||
      header === "follow up" ||
      header.includes("follow-up") ||
      header.includes("follow up"),
  },
];

type QuestionKey = "date" | "job" | "question" | "answer" | "status";

const QUESTION_TESTS: { key: QuestionKey; test: (header: string) => boolean }[] = [
  { key: "date", test: (header) => header === "date" },
  {
    key: "job",
    test: (header) => header === "job/company" || header === "job / company" || header === "job" || header === "company",
  },
  { key: "question", test: (header) => header === "question" },
  { key: "answer", test: (header) => header === "answer" },
  { key: "status", test: (header) => header === "status" },
];

const TIME_ZONE = "America/New_York";

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[?:]+$/g, "")
    .trim();
}

export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (Number.isInteger(value)) return String(value);
    const rounded = Math.round(value * 100) / 100;
    return String(rounded);
  }
  return String(value).trim();
}

export function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,]/g, "").trim();
    if (!cleaned || /^na$/i.test(cleaned) || cleaned === "—" || cleaned === "-") return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseSheetDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value < 20000 || value > 80000) return null;
    const ms = Math.round((value - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || /^na$/i.test(text)) return null;
    const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const us = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) {
      return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
    }
  }
  return null;
}

export function parsePaused(value: unknown): boolean {
  if (value === true) return true;
  if (value === false || value == null || value === "") return false;
  if (typeof value === "number") return value === 1;
  const text = String(value).trim().toLowerCase();
  return text === "true" || text === "yes" || text === "y" || text === "1";
}

export function isOpenStatus(status: string): boolean {
  const text = status.trim().toLowerCase();
  return text === "" || text === "open";
}

export function isDoneStatus(status: string): boolean {
  return status.trim().toLowerCase() === "done";
}

export function sameText(left: string, right: string): boolean {
  return left.replace(/\s+/g, " ").trim() === right.replace(/\s+/g, " ").trim();
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function zonedISO(date: Date, timeZone = TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function startOfWeekISO(date: Date, timeZone = TIME_ZONE): string {
  const iso = zonedISO(date, timeZone);
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  const index = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday);
  const start = new Date(utc.getTime() - Math.max(index, 0) * 86400000);
  return start.toISOString().slice(0, 10);
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return iso;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatTimestamp(date: Date): string {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${formatted} ET`;
}

export function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}

function isDateHeader(header: string): boolean {
  return header === "date" || header === "date applied" || header.includes("follow");
}

function formatFieldValue(header: string, value: unknown): string {
  if (isDateHeader(header)) {
    const parsed = parseSheetDate(value);
    if (parsed) return parsed;
    return cellToString(value);
  }
  if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
  }
  return cellToString(value);
}

function indexFor(headers: string[], key: SemanticKey): number {
  const field = FIELD_TESTS.find((item) => item.key === key);
  if (!field) return -1;
  return headers.findIndex((header) => field.test(header));
}

export function findHeaderRow(rows: unknown[][]): number {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 20);
  for (let index = 0; index < limit; index += 1) {
    const headers = (rows[index] ?? []).map((cell) => normalizeHeader(cell)).filter(Boolean);
    if (headers.length < 3) continue;
    const keys = new Set<SemanticKey>();
    for (const header of headers) {
      for (const field of FIELD_TESTS) {
        if (field.test(header)) keys.add(field.key);
      }
    }
    const looksLikeHeader = keys.has("company") && (keys.has("role") || keys.has("status"));
    if (!looksLikeHeader) continue;
    if (keys.size > bestScore) {
      bestScore = keys.size;
      best = index;
    }
  }
  return best;
}

function readText(row: unknown[], index: number, header = ""): string {
  if (index < 0) return "";
  return formatFieldValue(header, row[index]);
}

export function parseApplications(rows: unknown[][]): Application[] {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex < 0) return [];
  const rawHeaders = rows[headerIndex] ?? [];
  const headers = rawHeaders.map((cell) => normalizeHeader(cell));
  const labels = rawHeaders.map((cell) => cellToString(cell));
  const indexes = Object.fromEntries(FIELD_TESTS.map((field) => [field.key, indexFor(headers, field.key)])) as Record<
    SemanticKey,
    number
  >;

  const applications: Application[] = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const company = readText(row, indexes.company, "company");
    const role = readText(row, indexes.role, "role");
    if (!company && !role) continue;
    const fields = labels.flatMap((header, column) => {
      if (!header) return [];
      const value = formatFieldValue(headers[column] ?? "", row[column]);
      return [{ header, value }];
    });
    applications.push({
      row: index + 1,
      fields,
      dateApplied: indexes.dateApplied >= 0 ? parseSheetDate(row[indexes.dateApplied]) : null,
      company,
      role,
      status: readText(row, indexes.status, "status"),
      score: indexes.score >= 0 ? parseNumber(row[indexes.score]) : null,
      matchScore: indexes.matchScore >= 0 ? parseNumber(row[indexes.matchScore]) : null,
      location: readText(row, indexes.location, "location"),
      arrangement: readText(row, indexes.arrangement, "arrangement"),
      cstPst: readText(row, indexes.cstPst, "cst/pst"),
      remotePoints: indexes.remotePoints >= 0 ? parseNumber(row[indexes.remotePoints]) : null,
      verificationNotes: readText(row, indexes.verificationNotes, "verification notes"),
      salary: readText(row, indexes.salary, "salary"),
      source: readText(row, indexes.source, "source"),
      applicationLink: readText(row, indexes.applicationLink, "application link"),
      followUp: readText(row, indexes.followUp, "follow-up"),
    });
  }
  return applications;
}

function questionColumn(headers: string[], key: QuestionKey): number {
  const field = QUESTION_TESTS.find((item) => item.key === key);
  if (!field) return -1;
  return headers.findIndex((header) => field.test(header));
}

export function locateQuestionColumns(rows: unknown[][]): QuestionColumns | null {
  let best = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 8);
  for (let index = 0; index < limit; index += 1) {
    const headers = (rows[index] ?? []).map((cell) => normalizeHeader(cell));
    const keys = new Set<QuestionKey>();
    for (const header of headers) {
      for (const field of QUESTION_TESTS) {
        if (field.test(header)) keys.add(field.key);
      }
    }
    if (!keys.has("question") || !(keys.has("answer") || keys.has("status"))) continue;
    if (keys.size > bestScore) {
      bestScore = keys.size;
      best = index;
    }
  }
  if (best < 0) return null;
  const headers = (rows[best] ?? []).map((cell) => normalizeHeader(cell));
  return {
    headerRow: best,
    date: questionColumn(headers, "date"),
    job: questionColumn(headers, "job"),
    question: questionColumn(headers, "question"),
    answer: questionColumn(headers, "answer"),
    status: questionColumn(headers, "status"),
  };
}

export function parseQuestions(rows: unknown[][]): Question[] {
  const columns = locateQuestionColumns(rows);
  if (!columns || columns.question < 0) return [];
  const questions: Question[] = [];
  for (let index = columns.headerRow + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const question = columns.question >= 0 ? cellToString(row[columns.question]) : "";
    const job = columns.job >= 0 ? cellToString(row[columns.job]) : "";
    const answer = columns.answer >= 0 ? cellToString(row[columns.answer]) : "";
    const status = columns.status >= 0 ? cellToString(row[columns.status]) : "";
    const dateValue = columns.date >= 0 ? row[columns.date] : "";
    const date = parseSheetDate(dateValue) ?? cellToString(dateValue);
    if (!question && !job && !answer && !status) continue;
    questions.push({
      row: index + 1,
      date,
      job,
      question,
      answer,
      status,
    });
  }
  return questions;
}

export function parseScoring(rows: unknown[][]): ScoringRule[] {
  const rules: ScoringRule[] = [];
  for (const row of rows) {
    const label = cellToString(row?.[0]);
    const value = cellToString(row?.[1]);
    if (!label && !value) continue;
    const labelKey = label.toLowerCase();
    const valueKey = value.toLowerCase();
    if ((labelKey === "scoring rules" || labelKey === "scoring rule") && valueKey === "value") continue;
    if (labelKey === "notes" && valueKey === "meaning") continue;
    rules.push({ label, value });
  }
  return rules;
}

export function summarize(applications: Application[], now = new Date()): Summary {
  const today = zonedISO(now);
  const weekStart = startOfWeekISO(now);
  const thisWeek = applications.filter(
    (application) =>
      application.dateApplied != null && application.dateApplied >= weekStart && application.dateApplied <= today,
  ).length;
  const scores = applications
    .map((application) => application.score)
    .filter((score): score is number => score != null);
  const counts = new Map<string, number>();
  for (const application of applications) {
    const status = application.status.trim() || "No status";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const statuses = [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status));
  const top = [...applications]
    .filter((application) => application.score != null)
    .sort((left, right) => {
      const byScore = (right.score ?? 0) - (left.score ?? 0);
      if (byScore !== 0) return byScore;
      const byMatch = (right.matchScore ?? -1) - (left.matchScore ?? -1);
      if (byMatch !== 0) return byMatch;
      return (right.dateApplied ?? "").localeCompare(left.dateApplied ?? "");
    })
    .slice(0, 5);

  return {
    total: applications.length,
    thisWeek,
    weekStart,
    today,
    averageScore: scores.length ? roundScore(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    scoredCount: scores.length,
    top,
    statuses,
  };
}

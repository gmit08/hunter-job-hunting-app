import { isOpenStatus, parseSheetMoment, type Application } from "./applications";

export const QUESTION_SORTS = [
  { id: "newest", label: "Newest to oldest" },
  { id: "oldest", label: "Oldest to newest" },
  { id: "desirability", label: "Desirability score high to low" },
  { id: "match", label: "Match score high to low" },
] as const;

export type QuestionSort = (typeof QUESTION_SORTS)[number]["id"];

export const DEFAULT_QUESTION_SORT: QuestionSort = "newest";

export const QUESTION_SORT_STORAGE_KEY = "hunter.questionSort";

export function parseQuestionSort(value: string | null | undefined): QuestionSort {
  if (value === "oldest" || value === "desirability" || value === "match" || value === "newest") return value;
  return DEFAULT_QUESTION_SORT;
}

export function readSessionQuestionSort(): QuestionSort {
  if (typeof window === "undefined") return DEFAULT_QUESTION_SORT;
  try {
    return parseQuestionSort(window.sessionStorage.getItem(QUESTION_SORT_STORAGE_KEY));
  } catch {
    return DEFAULT_QUESTION_SORT;
  }
}

export function writeSessionQuestionSort(sort: QuestionSort): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(QUESTION_SORT_STORAGE_KEY, sort);
  } catch {
    // The stack still uses the in-memory choice for this view.
  }
}

type JobScoreSource = Pick<Application, "company" | "role" | "score" | "matchScore" | "dateApplied">;

export type RankedQuestion = {
  row: number;
  date: string;
  job: string;
  score: number | null;
  matchScore: number | null;
  editable: boolean;
  open: boolean;
};

export type JobCard = {
  key: string;
  questions: RankedQuestion[];
  score: number | null;
  matchScore: number | null;
  newest: RankedQuestion;
};

function normalizeJobLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[—–−]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function scoresForJob(job: string, applications: readonly JobScoreSource[]): { score: number | null; matchScore: number | null } {
  const label = normalizeJobLabel(job);
  if (!label) return { score: null, matchScore: null };
  const matches = applications.flatMap((application) => {
    const company = normalizeJobLabel(application.company);
    const role = normalizeJobLabel(application.role);
    if (!company) return [];
    const combined = role ? `${company} ${role}` : company;
    const exact = label === combined || (role.length > 0 && label === `${role} ${company}`);
    const contains = role.length > 0 && label.includes(company) && label.includes(role);
    if (!exact && !contains) return [];
    return [{ application, exact }];
  });
  if (matches.length === 0) return { score: null, matchScore: null };
  matches.sort((left, right) => {
    if (left.exact !== right.exact) return left.exact ? -1 : 1;
    const leftDate = left.application.dateApplied ?? "";
    const rightDate = right.application.dateApplied ?? "";
    if (leftDate !== rightDate) return leftDate < rightDate ? 1 : -1;
    return 0;
  });
  const best = matches[0].application;
  return { score: best.score, matchScore: best.matchScore };
}

const DASH_VARIANTS = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;

export function parsedQuestionDate(value: string): string | null {
  return parseSheetMoment(value)?.day ?? null;
}

/** Negative when `left` is older. A later sheet row counts as newer. */
export function compareQuestionRecency(left: { row: number; date: string }, right: { row: number; date: string }): number {
  const leftMs = parseSheetMoment(left.date)?.ms ?? null;
  const rightMs = parseSheetMoment(right.date)?.ms ?? null;
  if (leftMs != null && rightMs != null && leftMs !== rightMs) return leftMs < rightMs ? -1 : 1;
  return left.row - right.row;
}

export function jobGroupKey(job: string): string {
  const linkedInId = job.match(/linkedin\.com\/jobs\/view\/(\d+)/i)?.[1] ?? "";
  let core = job.replace(/https?:\/\/\S+/gi, " ");
  const parenthesis = core.indexOf("(");
  if (parenthesis >= 0) core = core.slice(0, parenthesis);
  core = core
    .replace(DASH_VARIANTS, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s*-\s*/g, "-")
    .replace(/[\s\-.,;:]+$/g, "")
    .trim();
  if (!core && !linkedInId) return "";
  return linkedInId ? `${core}|li:${linkedInId}` : core;
}

export function jobDisplayTitle(job: string): string {
  let text = job.replace(/https?:\/\/\S+/gi, " ");
  const parenthesis = text.indexOf("(");
  if (parenthesis >= 0) text = text.slice(0, parenthesis);
  text = text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s\-–—]+$/u, "")
    .trim();
  return text || "A job";
}

export function compareSortedQuestions(sort: QuestionSort, left: RankedQuestion, right: RankedQuestion): number {
  if (sort === "newest") return compareQuestionRecency(right, left);
  if (sort === "oldest") return compareQuestionRecency(left, right);
  const leftScore = sort === "desirability" ? left.score : left.matchScore;
  const rightScore = sort === "desirability" ? right.score : right.matchScore;
  if (leftScore == null && rightScore == null) return compareQuestionRecency(left, right);
  if (leftScore == null) return 1;
  if (rightScore == null) return -1;
  if (leftScore !== rightScore) return rightScore - leftScore;
  return compareQuestionRecency(left, right);
}

export function buildJobCards(questions: readonly RankedQuestion[]): JobCard[] {
  const groups = new Map<string, RankedQuestion[]>();
  for (const question of questions) {
    if (!question.editable && !question.open) continue;
    const key = jobGroupKey(question.job) || `row:${question.row}`;
    const list = groups.get(key);
    if (list) list.push(question);
    else groups.set(key, [question]);
  }
  const cards: JobCard[] = [];
  for (const [key, members] of groups) {
    members.sort((left, right) => compareQuestionRecency(left, right));
    const newest = members[members.length - 1];
    cards.push({
      key,
      questions: members,
      score: members.find((item) => item.score != null)?.score ?? null,
      matchScore: members.find((item) => item.matchScore != null)?.matchScore ?? null,
      newest,
    });
  }
  return cards;
}

function compareJobCards(sort: QuestionSort, left: JobCard, right: JobCard): number {
  if (sort === "newest") return compareQuestionRecency(right.newest, left.newest);
  if (sort === "oldest") return compareQuestionRecency(left.newest, right.newest);
  const leftScore = sort === "desirability" ? left.score : left.matchScore;
  const rightScore = sort === "desirability" ? right.score : right.matchScore;
  if (leftScore == null && rightScore == null) return compareQuestionRecency(left.newest, right.newest);
  if (leftScore == null) return 1;
  if (rightScore == null) return -1;
  if (leftScore !== rightScore) return rightScore - leftScore;
  return compareQuestionRecency(left.newest, right.newest);
}

function indexOfRow(index: Map<number, number>, card: JobCard, pick: "min" | "max"): number {
  const values = card.questions
    .map((question) => index.get(question.row))
    .filter((value): value is number => value != null);
  if (values.length === 0) return pick === "min" ? Number.MAX_SAFE_INTEGER : -1;
  return pick === "min" ? Math.min(...values) : Math.max(...values);
}

export function orderJobCards(input: {
  questions: RankedQuestion[];
  sort: QuestionSort;
  sessionSaved: number[];
  skipped: number[];
}): string[] {
  const cards = buildJobCards(input.questions);
  const sessionIndex = new Map(input.sessionSaved.map((row, index) => [row, index]));
  const skipIndex = new Map(input.skipped.map((row, index) => [row, index]));
  const prior: JobCard[] = [];
  const session: JobCard[] = [];
  const open: JobCard[] = [];
  const skippedCards: JobCard[] = [];

  for (const card of cards) {
    const openMembers = card.questions.filter((question) => question.open);
    const wasSaved = card.questions.some((question) => sessionIndex.has(question.row));
    if (openMembers.length === 0) {
      if (wasSaved) session.push(card);
      else prior.push(card);
      continue;
    }
    if (openMembers.every((question) => skipIndex.has(question.row))) skippedCards.push(card);
    else open.push(card);
  }

  const bySort = (left: JobCard, right: JobCard) => compareJobCards(input.sort, left, right);
  prior.sort(bySort);
  open.sort(bySort);
  session.sort((left, right) => indexOfRow(sessionIndex, left, "max") - indexOfRow(sessionIndex, right, "max"));
  skippedCards.sort((left, right) => indexOfRow(skipIndex, left, "min") - indexOfRow(skipIndex, right, "min"));
  return [...prior, ...session, ...open, ...skippedCards].map((card) => card.key);
}

export function openJobCount(questions: readonly { row: number; job: string; status: string }[]): number {
  const keys = new Set<string>();
  for (const question of questions) {
    if (!isOpenStatus(question.status)) continue;
    keys.add(jobGroupKey(question.job) || `row:${question.row}`);
  }
  return keys.size;
}

export function orderQuestionRows(input: {
  questions: RankedQuestion[];
  sort: QuestionSort;
  sessionSaved: number[];
  skipped: number[];
}): number[] {
  const cards = new Map(buildJobCards(input.questions).map((card) => [card.key, card]));
  return orderJobCards(input).map((key) => {
    const card = cards.get(key);
    return card?.newest.row ?? -1;
  });
}

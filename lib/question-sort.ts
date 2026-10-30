import type { Application } from "./applications";
import { buildWizardOrder } from "./question-stack";

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
  score: number | null;
  matchScore: number | null;
  editable: boolean;
  open: boolean;
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

function dateKey(value: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

function compareOldest(left: RankedQuestion, right: RankedQuestion): number {
  const leftDate = dateKey(left.date);
  const rightDate = dateKey(right.date);
  if (leftDate && rightDate && leftDate !== rightDate) return leftDate < rightDate ? -1 : 1;
  if (leftDate && !rightDate) return -1;
  if (!leftDate && rightDate) return 1;
  return left.row - right.row;
}

export function compareSortedQuestions(sort: QuestionSort, left: RankedQuestion, right: RankedQuestion): number {
  if (sort === "oldest") return compareOldest(left, right);
  if (sort === "newest") {
    const leftDate = dateKey(left.date);
    const rightDate = dateKey(right.date);
    if (leftDate && rightDate && leftDate !== rightDate) return leftDate < rightDate ? 1 : -1;
    if (leftDate && !rightDate) return -1;
    if (!leftDate && rightDate) return 1;
    return left.row - right.row;
  }
  const leftScore = sort === "desirability" ? left.score : left.matchScore;
  const rightScore = sort === "desirability" ? right.score : right.matchScore;
  if (leftScore == null && rightScore == null) return compareOldest(left, right);
  if (leftScore == null) return 1;
  if (rightScore == null) return -1;
  if (leftScore !== rightScore) return rightScore - leftScore;
  return compareOldest(left, right);
}

export function orderQuestionRows(input: {
  questions: RankedQuestion[];
  sort: QuestionSort;
  sessionSaved: number[];
  skipped: number[];
}): number[] {
  const ranked = [...input.questions].sort((left, right) => compareSortedQuestions(input.sort, left, right));
  return buildWizardOrder({
    sheetRows: ranked.map((question) => ({
      row: question.row,
      editable: question.editable,
      open: question.open,
    })),
    sessionSaved: input.sessionSaved,
    skipped: input.skipped,
  });
}

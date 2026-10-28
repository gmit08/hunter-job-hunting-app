import {
  isDoneStatus,
  parseApplications,
  parseQuestions,
  parseScoring,
  summarize,
  zonedISO,
  type Application,
  type Question,
  type ScoringRule,
  type Summary,
} from "./applications";

export type DashboardSource = "sample" | "sheet" | "error" | "demo";

export type DashboardData = {
  source: DashboardSource;
  message?: string;
  persona?: string;
  serviceAccountEmail?: string;
  spreadsheetUrl?: string;
  paused: boolean;
  applications: Application[];
  questions: Question[];
  scoring: ScoringRule[];
  summary: Summary;
  fetchedAt: string;
  webhookReady: boolean;
  generatedAt: number;
};

type SampleStore = {
  paused: boolean;
  answers: Record<number, { answer: string; status: string }>;
};

const globalStore = globalThis as typeof globalThis & { __jobDashboardSample?: SampleStore };
if (!globalStore.__jobDashboardSample) {
  globalStore.__jobDashboardSample = { paused: false, answers: {} };
}
const sampleStore = globalStore.__jobDashboardSample;

function daysAgo(days: number, now = new Date()): string {
  const iso = zonedISO(now);
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const SAMPLE_HEADERS = [
  "Date Applied",
  "Company",
  "Job Title",
  "Status",
  "Desirability Score",
  "Match Score",
  "Job Location",
  "Work Arrangement",
  "CST/PST",
  "Salary",
  "Source",
  "Application Link",
  "Contact / Follow-up",
  "Verification Notes",
  "Remote Points",
];

function sampleRows(now = new Date()): unknown[][] {
  const row = (
    date: string,
    company: string,
    role: string,
    status: string,
    score: number | "",
    match: number | "",
    location: string,
    arrangement: string,
    cst: string,
    salary: string,
    source: string,
    link: string,
    followUp: string,
    notes: string,
    remote: number | "",
  ) => [date, company, role, status, score, match, location, arrangement, cst, salary, source, link, followUp, notes, remote];

  return [
    ["", "Sample applications for preview"],
    [],
    [],
    SAMPLE_HEADERS,
    row(
      daysAgo(1, now),
      "Northwind Analytics",
      "Senior Product Manager",
      "Applied",
      180,
      86,
      "Remote, United States",
      "Remote",
      "N",
      "$155,000–$175,000",
      "Sample board",
      "https://example.com/jobs/northwind",
      daysAgo(1, now),
      "Remote role with a posted salary range. Hours are Eastern, so the time-zone flag is N.",
      25,
    ),
    row(
      daysAgo(0, now),
      "Harbor & Co.",
      "Product Manager, Platform",
      "Applied",
      150,
      82,
      "New York, NY",
      "Hybrid",
      "NA",
      "$160,000–$180,000",
      "Sample board",
      "https://example.com/jobs/harbor",
      daysAgo(0, now),
      "Hybrid role in a large city. Distance is already included in the desirability score.",
      0,
    ),
    row(
      daysAgo(2, now),
      "Lumen Field Health",
      "Senior Product Manager",
      "Interview",
      210,
      79,
      "Remote, United States",
      "Remote",
      "Y",
      "$165,000–$185,000",
      "Sample board",
      "https://example.com/jobs/lumen",
      daysAgo(2, now),
      "Recruiter asked for a Thursday afternoon interview. The time-zone flag is Y.",
      45,
    ),
    row(
      daysAgo(3, now),
      "Juniper Labs",
      "AI Product Manager",
      "Applied",
      "",
      88,
      "Boston, MA",
      "Hybrid",
      "NA",
      "$170,000–$190,000",
      "Sample board",
      "https://example.com/jobs/juniper",
      "",
      "Salary was found. The desirability score has not been filled in yet.",
      "",
    ),
    row(
      daysAgo(9, now),
      "Brightline Goods",
      "Product Manager",
      "Applied",
      100,
      74,
      "Portland, OR",
      "Hybrid",
      "N",
      "$130,000–$145,000",
      "Sample board",
      "https://example.com/jobs/brightline",
      daysAgo(2, now),
      "Posted pay is below the sample target. The benefits match supplies the score.",
      0,
    ),
    row(
      daysAgo(12, now),
      "Kepler Systems",
      "Technical Product Manager",
      "Applied",
      125,
      80,
      "Remote, Central Time",
      "Remote",
      "Y",
      "$150,000",
      "Sample board",
      "https://example.com/jobs/kepler",
      daysAgo(5, now),
      "Remote role on Central hours. The time-zone flag is Y.",
      45,
    ),
    row(
      daysAgo(20, now),
      "Paper Lantern Studio",
      "Project Manager",
      "Withdrawn",
      50,
      61,
      "Manhattan, NY",
      "On-site",
      "N",
      "$90,000",
      "Sample board",
      "",
      "",
      "Withdrawn. Pay is below the sample target and the role is on-site.",
      0,
    ),
    row(
      daysAgo(30, now),
      "Cedar & Oak",
      "Product Manager",
      "Applied",
      0,
      70,
      "Remote, United States",
      "Remote",
      "NA",
      "Not listed",
      "Sample board",
      "https://example.com/jobs/cedar",
      "",
      "No salary posted, so salary and remote points are zero.",
      0,
    ),
  ];
}

const SAMPLE_QUESTION_ROWS: unknown[][] = [
  ["Date", "Job/Company", "Question", "Answer", "Status", "Source"],
  [
    "",
    "Lumen Field Health — Senior Product Manager",
    "They asked if you can interview Thursday at 2pm ET. Should I say yes?",
    "",
    "Open",
    "",
  ],
  [
    "",
    "Northwind Analytics — Senior Product Manager",
    "The form wants a desired salary. Should I enter 160000?",
    "",
    "Open",
    "LinkedIn",
  ],
  [
    "",
    "Brightline Goods — Product Manager",
    "The form asks if you need sponsorship. What should I answer?",
    "No. I do not need sponsorship.",
    "Answered",
    "ZipRecruiter",
  ],
  [
    "",
    "Kepler Labs — Product Manager",
    "Can you start in two weeks?",
    "Yes. Two weeks from the offer.",
    "Done",
    "LinkedIn",
  ],
];

const SAMPLE_SCORING_ROWS: unknown[][] = [
  ["Scoring rules", "Value"],
  ["Benefits match", "Yes: 100"],
  ["Hybrid distance", "Closer offices score higher. Far offices score 0."],
  ["Salary band", "Below the target: 0. Mid band: 100. Above the target: 150."],
  ["Remote bonus", "Remote roles add points. A preferred time zone adds more."],
  ["Notes", "Meaning"],
  ["Yellow cells", "User overrides"],
  ["Match score", "0–100 experience fit assessment, not hiring probability."],
];

function withSampleDates(questions: Question[], now = new Date()): Question[] {
  const dates = [daysAgo(0, now), daysAgo(1, now), daysAgo(6, now), daysAgo(8, now)];
  return questions.map((question, index) => ({ ...question, date: dates[index] ?? question.date }));
}

export function sampleApplications(now = new Date()): Application[] {
  return parseApplications(sampleRows(now));
}

export function sampleQuestions(now = new Date()): Question[] {
  return withSampleDates(parseQuestions(SAMPLE_QUESTION_ROWS), now).map((question) => {
    const saved = sampleStore.answers[question.row];
    if (!saved) return question;
    return { ...question, answer: saved.answer, status: saved.status };
  });
}

export function sampleScoring(): ScoringRule[] {
  return parseScoring(SAMPLE_SCORING_ROWS);
}

export function sampleDashboard(fetchedAt: string, webhookReady: boolean, now = new Date()): DashboardData {
  const applications = sampleApplications(now);
  const questions = sampleQuestions(now);
  return {
    source: "sample",
    message: "These are sample applications, so you can click around before the Google Sheet is connected.",
    paused: sampleStore.paused,
    applications,
    questions,
    scoring: sampleScoring(),
    summary: summarize(applications, now),
    fetchedAt,
    webhookReady,
    generatedAt: now.getTime(),
  };
}

export function sampleSetPaused(paused: boolean) {
  sampleStore.paused = paused;
}

export function sampleSaveAnswer(row: number, question: string, answer: string): Question {
  const current = parseQuestions(SAMPLE_QUESTION_ROWS).find((item) => item.row === row);
  if (!current || current.question.replace(/\s+/g, " ").trim() !== question.replace(/\s+/g, " ").trim()) {
    throw new Error("That question changed. Refresh the page and try again.");
  }
  const saved = sampleStore.answers[row];
  const status = saved?.status ?? current.status;
  if (isDoneStatus(status)) {
    throw new Error("That question was already sent, so it can't be edited.");
  }
  sampleStore.answers[row] = { answer, status: "Answered" };
  return { ...current, answer, status: "Answered" };
}

export function emptyDashboard(input: {
  message: string;
  fetchedAt: string;
  webhookReady: boolean;
  serviceAccountEmail?: string;
  spreadsheetUrl?: string;
}): DashboardData {
  return {
    source: "error",
    message: input.message,
    serviceAccountEmail: input.serviceAccountEmail,
    spreadsheetUrl: input.spreadsheetUrl,
    paused: false,
    applications: [],
    questions: [],
    scoring: [],
    summary: summarize([]),
    fetchedAt: input.fetchedAt,
    webhookReady: input.webhookReady,
    generatedAt: Date.now(),
  };
}

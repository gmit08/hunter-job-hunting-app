import "server-only";

import { GoogleAuth, type JWTInput } from "google-auth-library";
import { connection } from "next/server";
import {
  columnLetter,
  formatTimestamp,
  isDoneStatus,
  locateQuestionColumns,
  parseApplications,
  parsePaused,
  parseQuestions,
  parseScoring,
  sameText,
  summarize,
  type Question,
} from "./applications";
import {
  emptyDashboard,
  sampleDashboard,
  sampleQuestions,
  sampleSaveAnswer,
  sampleSetPaused,
  type DashboardData,
} from "./mock-data";
import {
  COMPLETED_CELL_LABEL,
  parseCompletedCell,
  parseCompletionTimestamp,
} from "./three-day-check";
import { buildDemoDashboard, demoQuestions } from "./demo-data";
import { isDemoMode } from "./mode";
import { webhookConfigured } from "./webhook";

const MISSING_SPREADSHEET = "Set SPREADSHEET_ID to the spreadsheet you shared with the service account.";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const APPLICATIONS_TAB = "Applications";
const SCORING_TAB = "Scoring";
const CONTROL_TAB = "Dashboard Control";
const QUESTIONS_TAB = "Pending Questions";

type CredentialState =
  | { status: "missing" }
  | { status: "invalid"; message: string }
  | { status: "ready"; credentials: JWTInput; email: string };

let authClient: GoogleAuth | null = null;

function spreadsheetId(): string | null {
  return process.env.SPREADSHEET_ID?.trim() || null;
}

function spreadsheetUrl(): string | undefined {
  const id = spreadsheetId();
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : undefined;
}

function readCredentialState(): CredentialState {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as JWTInput;
      if (typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      const email = typeof parsed.client_email === "string" ? parsed.client_email : "";
      if (!email || typeof parsed.private_key !== "string" || !parsed.private_key.includes("PRIVATE KEY")) {
        return {
          status: "invalid",
          message:
            "GOOGLE_SERVICE_ACCOUNT_JSON is missing the service account email or the private key. Paste the whole key file.",
        };
      }
      return { status: "ready", credentials: parsed, email };
    } catch {
      return {
        status: "invalid",
        message:
          "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the entire key file as one value, including the curly braces.",
      };
    }
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ?? "";
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim() ?? "";
  if (!email && !privateKey) return { status: "missing" };
  if (!email || !privateKey) {
    return {
      status: "invalid",
      message: "Set both GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY, or paste GOOGLE_SERVICE_ACCOUNT_JSON.",
    };
  }
  return {
    status: "ready",
    email,
    credentials: {
      client_email: email,
      private_key: privateKey.replace(/\\n/g, "\n"),
    },
  };
}

function friendlySheetError(status: number, email: string, body: string): string {
  if (status === 401 || status === 403) {
    return `Google refused access. In the spreadsheet, click Share and add ${email} as an Editor. Also confirm the Google Sheets API is turned on for this service account's project.`;
  }
  if (status === 404) {
    return "That spreadsheet was not found. Check SPREADSHEET_ID.";
  }
  const snippet = body.replace(/\s+/g, " ").slice(0, 180);
  if (status === 400 && /unable to parse range/i.test(snippet)) {
    return "A tab the dashboard needs is missing or has an unexpected name.";
  }
  return snippet
    ? `The spreadsheet could not be read (${status}). ${snippet}`
    : `The spreadsheet could not be read (${status}).`;
}

async function accessToken(credentials: JWTInput): Promise<string> {
  if (!authClient) {
    authClient = new GoogleAuth({ credentials, scopes: [SHEETS_SCOPE] });
  }
  const client = await authClient.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Google did not return an access token. Check the service account key.");
  return token.token;
}

async function sheetsRequest<T>(credentials: JWTInput, email: string, path: string, init?: RequestInit): Promise<T> {
  const id = spreadsheetId();
  if (!id) throw new Error(MISSING_SPREADSHEET);
  const token = await accessToken(credentials);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(friendlySheetError(response.status, email, body));
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

function quoteTab(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

type SpreadsheetMeta = {
  sheets?: { properties?: { title?: string } }[];
};

async function sheetTitles(credentials: JWTInput, email: string): Promise<Set<string>> {
  const meta = await sheetsRequest<SpreadsheetMeta>(
    credentials,
    email,
    "?fields=sheets.properties.title",
  );
  return new Set(
    (meta.sheets ?? []).map((sheet) => sheet.properties?.title).filter((title): title is string => Boolean(title)),
  );
}

async function writeCells(
  credentials: JWTInput,
  email: string,
  data: { range: string; values: unknown[][] }[],
) {
  await sheetsRequest(credentials, email, "/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data,
    }),
  });
}

async function ensureControlTabs(credentials: JWTInput, email: string, titles: Set<string>) {
  const requests = [];
  if (!titles.has(CONTROL_TAB)) {
    requests.push({ addSheet: { properties: { title: CONTROL_TAB } } });
  }
  if (!titles.has(QUESTIONS_TAB)) {
    requests.push({ addSheet: { properties: { title: QUESTIONS_TAB } } });
  }
  if (requests.length) {
    try {
      await sheetsRequest(credentials, email, ":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (!/already exists/i.test(message)) throw error;
    }
  }
  const writes: { range: string; values: unknown[][] }[] = [];
  if (!titles.has(CONTROL_TAB)) {
    writes.push({
      range: `${quoteTab(CONTROL_TAB)}!A1:B2`,
      values: [
        ["Paused", false],
        [COMPLETED_CELL_LABEL, ""],
      ],
    });
  }
  if (!titles.has(QUESTIONS_TAB)) {
    writes.push({
      range: `${quoteTab(QUESTIONS_TAB)}!A1:F1`,
      values: [["Date", "Job/Company", "Question", "Answer", "Status", "Source"]],
    });
  }
  if (writes.length) await writeCells(credentials, email, writes);
}

type ValueRange = { range?: string; values?: unknown[][] };
type BatchValues = { valueRanges?: ValueRange[] };

async function readRanges(credentials: JWTInput, email: string, ranges: string[]): Promise<unknown[][][]> {
  const params = new URLSearchParams();
  params.set("valueRenderOption", "UNFORMATTED_VALUE");
  params.set("majorDimension", "ROWS");
  for (const range of ranges) params.append("ranges", range);
  const payload = await sheetsRequest<BatchValues>(credentials, email, `/values:batchGet?${params.toString()}`);
  return (payload.valueRanges ?? []).map((range) => range.values ?? []);
}

async function readLive(credentials: JWTInput, email: string, now: Date): Promise<DashboardData> {
  let titles = await sheetTitles(credentials, email);
  if (!titles.has(APPLICATIONS_TAB)) {
    throw new Error("The spreadsheet has no tab named Applications.");
  }
  await ensureControlTabs(credentials, email, titles);
  titles = await sheetTitles(credentials, email);

  const ranges = [`${quoteTab(APPLICATIONS_TAB)}!A1:BZ1000`];
  if (titles.has(SCORING_TAB)) ranges.push(`${quoteTab(SCORING_TAB)}!A1:B80`);
  ranges.push(`${quoteTab(CONTROL_TAB)}!A1:B1`);
  ranges.push(`${quoteTab(QUESTIONS_TAB)}!A1:Z1000`);

  const [applicationRows, second, third, fourth] = await readRanges(credentials, email, ranges);
  const scoringRows = titles.has(SCORING_TAB) ? second : [];
  const controlRows = titles.has(SCORING_TAB) ? third : second;
  const questionRows = titles.has(SCORING_TAB) ? fourth : third;
  const applications = parseApplications(applicationRows ?? []);

  return {
    source: "sheet",
    serviceAccountEmail: email,
    spreadsheetUrl: spreadsheetUrl(),
    paused: parsePaused(controlRows?.[0]?.[1]),
    applications,
    questions: parseQuestions(questionRows ?? []),
    scoring: parseScoring(scoringRows ?? []),
    summary: summarize(applications, now),
    fetchedAt: formatTimestamp(now),
    webhookReady: webhookConfigured(),
    generatedAt: now.getTime(),
  };
}

export async function loadQuestions(): Promise<Question[]> {
  await connection();
  if (isDemoMode()) return demoQuestions(new Date());
  const state = readCredentialState();
  if (state.status === "missing") return sampleQuestions();
  if (state.status === "invalid") throw new Error(state.message);
  if (!spreadsheetId()) throw new Error(MISSING_SPREADSHEET);
  const titles = await sheetTitles(state.credentials, state.email);
  await ensureControlTabs(state.credentials, state.email, titles);
  const [rows] = await readRanges(state.credentials, state.email, [`${quoteTab(QUESTIONS_TAB)}!A1:Z1000`]);
  return parseQuestions(rows ?? []);
}

export async function loadDashboard(): Promise<DashboardData> {
  await connection();
  const now = new Date();
  if (isDemoMode()) return buildDemoDashboard(now);
  const fetchedAt = formatTimestamp(now);
  const webhookReady = webhookConfigured();
  const state = readCredentialState();
  if (state.status === "missing") return sampleDashboard(fetchedAt, webhookReady, now);
  if (state.status === "invalid") {
    return emptyDashboard({ message: state.message, fetchedAt, webhookReady });
  }
  if (!spreadsheetId()) {
    return emptyDashboard({
      message: MISSING_SPREADSHEET,
      fetchedAt,
      webhookReady,
      serviceAccountEmail: state.email,
    });
  }
  try {
    return await readLive(state.credentials, state.email, now);
  } catch (error) {
    return emptyDashboard({
      message: error instanceof Error ? error.message : "The spreadsheet could not be read.",
      fetchedAt,
      webhookReady,
      serviceAccountEmail: state.email,
      spreadsheetUrl: spreadsheetUrl(),
    });
  }
}

async function requireLive() {
  const state = readCredentialState();
  if (state.status === "missing") return { state, live: false as const };
  if (state.status === "invalid") throw new Error(state.message);
  if (!spreadsheetId()) throw new Error(MISSING_SPREADSHEET);
  return { state, live: true as const };
}

export async function readThreeDayCheckCompletedAt(): Promise<{ completedAt: string | null }> {
  await connection();
  const parsed = parseCompletedCell(process.env.THREEDAYCHECK_COMPLETED_CELL);
  if (!parsed) {
    throw new Error("THREEDAYCHECK_COMPLETED_CELL must be one cell, like Dashboard Control!B2.");
  }
  const { state, live } = await requireLive();
  if (!live) return { completedAt: null };
  const titles = await sheetTitles(state.credentials, state.email);
  await ensureControlTabs(state.credentials, state.email, titles);
  const [rows] = await readRanges(state.credentials, state.email, [`${quoteTab(parsed.tab)}!${parsed.cell}`]);
  const completedMs = parseCompletionTimestamp(rows?.[0]?.[0]);
  return { completedAt: completedMs == null ? null : new Date(completedMs).toISOString() };
}

export async function setPaused(paused: boolean): Promise<{ paused: boolean; sample: boolean }> {
  const { state, live } = await requireLive();
  if (!live) {
    sampleSetPaused(paused);
    return { paused, sample: true };
  }
  const titles = await sheetTitles(state.credentials, state.email);
  await ensureControlTabs(state.credentials, state.email, titles);
  const control = await readRanges(state.credentials, state.email, [`${quoteTab(CONTROL_TAB)}!A1:B1`]);
  const label = control[0]?.[0]?.[0];
  const writes: { range: string; values: unknown[][] }[] = [
    { range: `${quoteTab(CONTROL_TAB)}!B1`, values: [[paused]] },
  ];
  if (label == null || String(label).trim() === "") {
    writes.push({ range: `${quoteTab(CONTROL_TAB)}!A1`, values: [["Paused"]] });
  }
  await writeCells(state.credentials, state.email, writes);
  return { paused, sample: false };
}

export async function saveAnswer(input: {
  row: number;
  question: string;
  answer: string;
}): Promise<{ sample: boolean }> {
  const answer = input.answer.trim();
  if (!answer) throw new Error("Type an answer first.");
  if (answer.length > 4000) throw new Error("That answer is too long. Keep it under 4,000 characters.");
  if (!Number.isInteger(input.row) || input.row < 2) throw new Error("That question could not be found.");

  const { state, live } = await requireLive();
  if (!live) {
    sampleSaveAnswer(input.row, input.question, answer);
    return { sample: true };
  }

  const titles = await sheetTitles(state.credentials, state.email);
  await ensureControlTabs(state.credentials, state.email, titles);
  const [rows] = await readRanges(state.credentials, state.email, [`${quoteTab(QUESTIONS_TAB)}!A1:Z1000`]);
  const columns = locateQuestionColumns(rows ?? []);
  if (!columns || columns.answer < 0 || columns.status < 0 || columns.question < 0) {
    throw new Error("The Pending Questions tab needs Question, Answer, and Status columns.");
  }
  const record = (rows ?? [])[input.row - 1];
  const current = record?.[columns.question];
  if (!sameText(String(current ?? ""), input.question)) {
    throw new Error("That question changed in the sheet. Refresh the page and try again.");
  }
  if (isDoneStatus(String(record?.[columns.status] ?? ""))) {
    throw new Error("That question was already sent, so it can't be edited.");
  }
  await writeCells(state.credentials, state.email, [
    {
      range: `${quoteTab(QUESTIONS_TAB)}!${columnLetter(columns.answer)}${input.row}`,
      values: [[answer]],
    },
    {
      range: `${quoteTab(QUESTIONS_TAB)}!${columnLetter(columns.status)}${input.row}`,
      values: [["Answered"]],
    },
  ]);
  return { sample: false };
}

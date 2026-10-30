import {
  formatTimestamp,
  parseApplications,
  parseQuestions,
  parseScoring,
  summarize,
  zonedISO,
  type Question,
} from "./applications";
import { type DashboardData } from "./mock-data";

export const DEMO_PERSONA = "Jordan Rivera, PharmD";

export const DEMO_PERSONA_LINE =
  "Jordan Rivera, PharmD · Cedar Hollow, Colorado · salary target $148,000–$168,000, with loan repayment and a 403(b) match.";

const HEADERS = [
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

function daysAgo(days: number, now: Date): string {
  const iso = zonedISO(now);
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function applicationRows(now: Date): unknown[][] {
  const row = (
    days: number,
    company: string,
    role: string,
    status: string,
    score: number | "",
    match: number | "",
    location: string,
    arrangement: string,
    cst: string,
    salary: string,
    link: string,
    followUp: string,
    notes: string,
    remote: number | "",
  ) => [
    daysAgo(days, now),
    company,
    role,
    status,
    score,
    match,
    location,
    arrangement,
    cst,
    salary,
    "Demo board",
    link,
    followUp,
    notes,
    remote,
  ];

  return [
    HEADERS,
    row(1, "Willowbrook Health", "Clinical Pharmacist", "Interview", 176, 91, "Cedar Hollow, Colorado", "Hybrid", "Y", "$158,000–$172,000", "https://example.com/jobs/willowbrook/clinical-pharmacist/panel-interview-cedar-hollow-anticoagulation-cases-residency-project-loan-repayment", daysAgo(1, now), "Panel interview Thursday. Review anticoagulation cases and the residency project.", 20),
    row(0, "Northhaven Community Hospital", "Clinical Pharmacist, Evenings", "Applied", 142, 84, "Cedar Hollow, Colorado", "On-site", "NA", "$150,000–$164,000", "https://example.com/jobs/northhaven", "", "Evening block. Benefits include a 403(b) match, no loan repayment.", 0),
    row(2, "Lantern Oncology Partners", "Oncology Pharmacist", "Interview", 188, 96, "Cedar Hollow, Colorado", "Hybrid", "Y", "$162,000–$178,000", "https://example.com/jobs/lantern", daysAgo(2, now), "Second interview next week. Prep the infusion verification scenarios.", 25),
    row(4, "Pineshade Specialty Pharmacy", "Specialty Pharmacist", "Applied", 161, 86, "Remote, Mountain time", "Remote", "Y", "$155,000–$170,000", "https://example.com/jobs/pineshade", "", "Specialty queue for complex oral regimens. Loan repayment is listed.", 40),
    row(3, "Redcedar Ambulatory Clinics", "Ambulatory Care Pharmacist", "Applied", 170, 88, "Cedar Hollow, Colorado", "Hybrid", "Y", "$152,000–$166,000", "https://example.com/jobs/redcedar", daysAgo(3, now), "Collaborative practice in primary care. Clinic is a short drive.", 15),
    row(6, "Highdesert Therapy Group", "Remote Medication Therapy Pharmacist", "Offer", 194, 94, "Remote, United States", "Remote", "Y", "$160,000–$174,000", "https://example.com/jobs/highdesert", daysAgo(1, now), "Offer in the target band. Includes loan repayment and a 403(b) match.", 50),
    row(5, "Solstice Informatics Collaborative", "Pharmacy Informatics Pharmacist", "Applied", 166, 87, "Remote, Mountain time", "Remote", "Y", "$156,000–$171,000", "https://example.com/jobs/solstice", "", "Order-set governance and alert tuning. Fully remote.", 45),
    row(8, "Harborlight Neighborhood Pharmacy", "Retail Pharmacy Manager", "Applied", 118, 79, "Cedar Hollow, Colorado", "On-site", "N", "$140,000–$152,000", "https://example.com/jobs/harborlight", "", "Store leadership. Pay starts below the target. No loan repayment.", 0),
    row(21, "Aster Grove Pharmacy", "Retail Pharmacy Manager", "Withdrawn", 72, 63, "Farther Ridge", "On-site", "N", "$128,000", "https://example.com/jobs/aster", "", "Withdrawn. The commute is long and the salary is below the target.", 0),
    row(7, "Larkspur Infusion Rooms", "Oncology Infusion Pharmacist", "Applied", 154, 82, "Cedar Hollow, Colorado", "On-site", "NA", "$159,000–$173,000", "https://example.com/jobs/larkspur", "", "Chair-side verification. Strong clinical fit, on-site only.", 0),
    row(11, "Copperleaf Rural Health", "Staff Pharmacist", "Applied", 108, 75, "Copperleaf", "On-site", "N", "$136,000–$146,000", "https://example.com/jobs/copperleaf", "", "Critical access hospital. Lower band, housing stipend instead of loan repayment.", 0),
    row(9, "Quietpine Mail Pharmacy", "Remote Medication Therapy Pharmacist", "Applied", 149, 85, "Remote, United States", "Remote", "Y", "$151,000–$165,000", "https://example.com/jobs/quietpine", daysAgo(4, now), "Mail-order MTM. Remote, with a 403(b) match.", 40),
    row(10, "Bluefern Clinical Network", "Transitions of Care Pharmacist", "Applied", 146, 81, "Cedar Hollow, Colorado", "Hybrid", "Y", "$149,000–$162,000", "https://example.com/jobs/bluefern", "", "Discharge counseling across two clinics.", 10),
    row(14, "Meadowglass Health Cooperative", "Ambulatory Care Pharmacist", "Applied", 136, 78, "Meadowglass", "Hybrid", "N", "$147,000–$160,000", "https://example.com/jobs/meadowglass", "", "Chronic disease clinic. Just under the salary target.", 5),
    row(13, "Fernhollow Specialty", "Specialty Pharmacist, Neurology", "Applied", 128, 77, "Remote, Mountain time", "Remote", "Y", "$150,000–$163,000", "https://example.com/jobs/fernhollow", "", "Limited distribution drugs. Remote prior-authorization support.", 35),
    row(15, "Summitridge Clinics", "Clinical Pharmacy Specialist", "Applied", 157, 83, "Cedar Hollow, Colorado", "Hybrid", "Y", "$154,000–$168,000", "https://example.com/jobs/summitridge", "", "Anticoagulation and heart failure clinics.", 15),
    row(12, "Brightmesa Health", "Pharmacy Informatics Pharmacist", "Applied", "", 74, "Brightmesa", "Hybrid", "NA", "$153,000–$167,000", "https://example.com/jobs/brightmesa", "", "Salary is posted. The desirability score is not filled in yet.", 10),
    row(28, "Oakmill Pharmacy Group", "Retail Pharmacy Manager", "Applied", 96, 70, "Oakmill", "On-site", "N", "$132,000–$144,000", "https://example.com/jobs/oakmill", "", "Multi-store manager. Pay is below the target and the role is on-site.", 0),
  ];
}

const DEMO_POSTING_URL =
  "https://www.ziprecruiter.com/jobs-search?search=Product+Manager&location=Remote+%28USA%29&days=1&lk=exampleToken0123456789";

const DEMO_APPLY_PAGE_URL =
  "https://jobs.ashbyhq.com/example-co/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/application";

const DEMO_LINK_COLUMN_URL =
  "https://jobs.ashbyhq.com/example-co/11111111-2222-4333-8444-555555555555/application";

function questionRows(): unknown[][] {
  return [
    ["Date", "Job/Company", "Question", "Answer", "Status", "Source", "Link"],
    [
      "",
      "Solstice Informatics Collaborative — Pharmacy Informatics Pharmacist",
      `I couldn't submit this application. A captcha security check blocked the form. Posting: ${DEMO_POSTING_URL} . Apply page: ${DEMO_APPLY_PAGE_URL} One required question has no saved answer. What should I enter for work authorization?`,
      "",
      "Open",
      "ZipRecruiter",
      "",
    ],
    [
      "",
      "Summitridge Clinics — Clinical Pharmacy Specialist",
      "What should I enter for the work-authorization question?",
      "",
      "Open",
      "LinkedIn",
      DEMO_LINK_COLUMN_URL,
    ],
    ["", "Willowbrook Health — Clinical Pharmacist", "They offered a panel interview Thursday at 2pm Mountain. The posting is https://example.com/jobs/willowbrook/clinical-pharmacist/panel-interview-cedar-hollow-anticoagulation-cases-residency-project. Should I accept?", "", "Open", "", ""],
    ["", "Quietpine Mail Pharmacy — Remote Medication Therapy Pharmacist", "I could not submit this application. Please apply directly: https://example.com/jobs/quietpine/remote-medication-therapy-pharmacist/apply-yourself-on-the-company-site", "", "Open", "LinkedIn", ""],
    ["", "Redcedar Ambulatory Clinics — Ambulatory Care Pharmacist", "The form wants a desired salary. Should I enter 158000?", "", "Open", "ZipRecruiter", ""],
    ["", "Highdesert Therapy Group — Remote Medication Therapy Pharmacist", "They asked which remote hours you can cover. What should I say?", "", "Open", "LinkedIn", ""],
    ["", "Lantern Oncology Partners — Oncology Pharmacist", "The form asks if you hold a board certification. What should I enter?", "", "Open", "LinkedIn", ""],
  ];
}

const SCORING_ROWS: unknown[][] = [
  ["Scoring rules", "Value"],
  ["Benefits match", "Loan repayment or a 403(b) match: 100."],
  ["Salary band", "Below $148,000: 0. From there to $168,000: 100. Above the target: 150."],
  ["Remote bonus", "Remote medication-therapy roles add points. A Mountain-time schedule adds more."],
  ["Hybrid distance", "Cedar Hollow clinics score higher. Far sites score 0."],
  ["Clinical preference", "Oncology, ambulatory care, and informatics rank above retail management."],
  ["Notes", "Meaning"],
  ["Yellow cells", "User overrides"],
  ["Match score", "0–100 experience fit, not a hiring probability."],
];

export function demoQuestions(now = new Date()): Question[] {
  const dates = [0, 1, 2, 3, 4, 6, 8].map((days) => daysAgo(days, now));
  return parseQuestions(questionRows()).map((question, index) => ({
    ...question,
    date: dates[index] ?? question.date,
  }));
}

export function buildDemoDashboard(now = new Date()): DashboardData {
  const applications = parseApplications(applicationRows(now));
  return {
    source: "demo",
    persona: DEMO_PERSONA_LINE,
    paused: false,
    applications,
    questions: demoQuestions(now),
    scoring: parseScoring(SCORING_ROWS),
    summary: summarize(applications, now),
    fetchedAt: formatTimestamp(now),
    webhookReady: true,
    generatedAt: now.getTime(),
  };
}

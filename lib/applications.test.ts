import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  columnLetter,
  findHeaderRow,
  isAnsweredStatus,
  isDoneStatus,
  isOpenStatus,
  questionSourceLabel,
  locateQuestionColumns,
  parseApplications,
  parsePaused,
  parseQuestions,
  parseSheetDate,
  parseScoring,
  startOfWeekISO,
  summarize,
} from "./applications";
import { sampleApplications, sampleQuestions, sampleSaveAnswer } from "./mock-data";

const NOW = new Date("2026-10-17T16:00:00-04:00");

describe("sheet dates and pause values", () => {
  it("converts the sheet serial for October 1, 2026", () => {
    assert.equal(parseSheetDate(46296), "2026-10-01");
    assert.equal(parseSheetDate("2026-10-16"), "2026-10-16");
    assert.equal(parseSheetDate("10/5/2026"), "2026-10-05");
    assert.equal(parseSheetDate("NA"), null);
  });

  it("treats only truthy pause values as paused", () => {
    assert.equal(parsePaused(true), true);
    assert.equal(parsePaused("TRUE"), true);
    assert.equal(parsePaused("yes"), true);
    assert.equal(parsePaused(false), false);
    assert.equal(parsePaused("FALSE"), false);
    assert.equal(parsePaused(""), false);
    assert.equal(parsePaused(null), false);
  });

  it("starts the week on Monday in Eastern time", () => {
    assert.equal(startOfWeekISO(NOW), "2026-10-12");
  });
});

describe("application headers", () => {
  it("reads headers by name from row 4, in any column order", () => {
    const rows = [
      ["", "Job applications tracker"],
      [],
      [],
      [
        "Remote Points",
        "Verification Notes",
        "CST/PST",
        "Desirability Score",
        "Status",
        "Job Title",
        "Company",
        "Date Applied",
        "Match Score",
      ],
      [25, "Checked the posting.", "Y", 150, "Applied", "Product Manager", "Acme", 46296, 90],
      ["", "", "", "", "", "", ""],
    ];

    assert.equal(findHeaderRow(rows), 3);
    const [application] = parseApplications(rows);
    assert.equal(application.row, 5);
    assert.equal(application.company, "Acme");
    assert.equal(application.role, "Product Manager");
    assert.equal(application.status, "Applied");
    assert.equal(application.score, 150);
    assert.equal(application.matchScore, 90);
    assert.equal(application.cstPst, "Y");
    assert.equal(application.remotePoints, 25);
    assert.equal(application.verificationNotes, "Checked the posting.");
    assert.equal(application.dateApplied, "2026-10-01");
    assert.equal(application.fields[0]?.header, "Remote Points");
    assert.equal(columnLetter(31), "AF");
  });

  it("summarizes totals, this week, the average, and the top scores", () => {
    const applications = sampleApplications(NOW);
    const summary = summarize(applications, NOW);
    assert.equal(summary.total, 8);
    assert.equal(summary.thisWeek, 4);
    assert.equal(summary.averageScore, 116.4);
    assert.equal(summary.scoredCount, 7);
    assert.equal(summary.top[0]?.company, "Lumen Field Health");
    assert.equal(summary.top[0]?.score, 210);
    assert.deepEqual(
      summary.statuses.map((item) => item.status),
      ["Applied", "Interview", "Withdrawn"],
    );
  });
});

describe("pending questions", { concurrency: false }, () => {
  it("finds columns by header and keeps open questions separate from answered ones", () => {
    const rows = [
      ["Status", "Answer", "Question", "Job/Company", "Date"],
      ["Open", "", "Can I say yes?", "Acme — PM", "2026-10-16"],
      ["Answered", "No sponsorship.", "Do you need sponsorship?", "Brightline", 46310],
      ["", "", "Is Thursday okay?", "Lumen", ""],
    ];
    const columns = locateQuestionColumns(rows);
    assert.deepEqual(columns, {
      headerRow: 0,
      date: 4,
      job: 3,
      question: 2,
      answer: 1,
      status: 0,
      source: -1,
    });
    const questions = parseQuestions(rows);
    assert.equal(questions.length, 3);
    assert.equal(questions.every((question) => question.source === "ZipRecruiter"), true);
    assert.equal(questions[1]?.date, "2026-10-15");
    assert.equal(isOpenStatus(questions[0]?.status ?? ""), true);
    assert.equal(isOpenStatus(questions[1]?.status ?? ""), false);
    assert.equal(isOpenStatus(questions[2]?.status ?? ""), true);
    assert.equal(columnLetter(columns?.answer ?? -1), "B");
  });

  it("loads sample questions with two still open", () => {
    const questions = sampleQuestions(NOW);
    const open = questions.filter((question) => isOpenStatus(question.status));
    assert.equal(open.length, 2);
    assert.equal(questions.some((question) => question.status === "Answered"), true);
    assert.equal(questions.filter((question) => question.source === "LinkedIn").length >= 1, true);
    assert.equal(questions.some((question) => question.source === "ZipRecruiter"), true);
    assert.equal(isDoneStatus("Done"), true);
    assert.equal(isDoneStatus("done "), true);
    assert.equal(isDoneStatus("Answered"), false);
    assert.equal(isDoneStatus("Open"), false);
  });

  it("refuses to edit a question the assistant already marked done", () => {
    const store = (
      globalThis as { __jobDashboardSample?: { answers: Record<number, { answer: string; status: string }> } }
    ).__jobDashboardSample;
    assert.ok(store);
    const row = 4;
    const previous = store.answers[row];
    store.answers[row] = { answer: "No. I do not need sponsorship.", status: "Done" };
    try {
      assert.throws(
        () =>
          sampleSaveAnswer(
            row,
            "The form asks if you need sponsorship. What should I answer?",
            "Yes",
          ),
        /already sent/,
      );
    } finally {
      if (previous) store.answers[row] = previous;
      else delete store.answers[row];
    }
  });
});

describe("question source", () => {
  it("reads Source by header and treats a blank as ZipRecruiter", () => {
    const rows = [
      ["Date", "Job/Company", "Question", "Answer", "Status", "Source"],
      ["2026-10-16", "Acme — PM", "Can I say yes?", "", "Open", ""],
      ["2026-10-16", "Northwind", "Salary?", "", "Answered", "ZipRecruiter"],
      ["2026-10-16", "Initech", "Start date?", "Monday", "Answered", "linkedin"],
      ["2026-10-16", "Hooli", "Remote?", "", "Done", "LinkedIn"],
    ];
    const columns = locateQuestionColumns(rows);
    assert.equal(columns?.source, 5);
    const questions = parseQuestions(rows);
    assert.deepEqual(
      questions.map((question) => question.source),
      ["ZipRecruiter", "ZipRecruiter", "LinkedIn", "LinkedIn"],
    );
    assert.equal(questionSourceLabel("  "), "ZipRecruiter");
    assert.equal(isAnsweredStatus("Answered"), true);
    assert.equal(isAnsweredStatus("Open"), false);
    assert.equal(isAnsweredStatus("Done"), false);
  });
});

describe("scoring rules", () => {
  it("skips the label row and keeps the rules", () => {
    const rules = parseScoring([
      ["Scoring rules", "Value"],
      ["401k match Y", 100],
      [],
      ["Notes", "Meaning"],
      ["Yellow cells", "User overrides"],
    ]);
    assert.deepEqual(
      rules.map((rule) => rule.label),
      ["401k match Y", "Yellow cells"],
    );
    assert.equal(rules[0]?.value, "100");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDemoDashboard } from "./demo-data";
import {
  DEFAULT_QUESTION_SORT,
  buildJobCards,
  compareQuestionRecency,
  compareSortedQuestions,
  jobGroupKey,
  orderQuestionRows,
  parseQuestionSort,
  scoresForJob,
  type QuestionSort,
  type RankedQuestion,
} from "./question-sort";
import { noteSaved, noteSkipped } from "./question-stack";

function row(
  rowNumber: number,
  date: string,
  score: number | null,
  matchScore: number | null,
  open = true,
  job = `Company ${rowNumber} — Role ${rowNumber}`,
): RankedQuestion {
  return { row: rowNumber, date, job, score, matchScore, editable: true, open };
}

const sample: RankedQuestion[] = [
  row(2, "2026-10-28", 166, 87),
  row(3, "2026-10-27", 157, 83),
  row(4, "2026-10-26", 176, 91),
  row(5, "2026-10-22", null, 99),
];

describe("question sort", () => {
  it("defaults to newest and ignores an unknown stored value", () => {
    assert.equal(DEFAULT_QUESTION_SORT, "newest");
    assert.equal(parseQuestionSort(null), "newest");
    assert.equal(parseQuestionSort("sheet"), "newest");
    assert.equal(parseQuestionSort("match"), "match");
  });

  it("orders by date, and puts a missing score last with older ties first", () => {
    const newest = orderQuestionRows({ questions: sample, sort: "newest", sessionSaved: [], skipped: [] });
    const oldest = orderQuestionRows({ questions: sample, sort: "oldest", sessionSaved: [], skipped: [] });
    const desirability = orderQuestionRows({ questions: sample, sort: "desirability", sessionSaved: [], skipped: [] });
    const match = orderQuestionRows({ questions: sample, sort: "match", sessionSaved: [], skipped: [] });
    assert.deepEqual(newest, [2, 3, 4, 5]);
    assert.deepEqual(oldest, [5, 4, 3, 2]);
    assert.deepEqual(desirability, [4, 2, 3, 5]);
    assert.deepEqual(match, [5, 4, 2, 3]);
    const tied = [row(8, "2026-10-02", 170, 80), row(9, "2026-10-20", 170, 80)];
    assert.equal(compareSortedQuestions("desirability", tied[0], tied[1]) < 0, true);
  });

  it("keeps a skipped card at the back and this session's saves in save order", () => {
    const start = orderQuestionRows({ questions: sample, sort: "desirability", sessionSaved: [], skipped: [] });
    assert.deepEqual(start, [4, 2, 3, 5]);
    const skipped = noteSkipped([], 4);
    const afterSkip = orderQuestionRows({ questions: sample, sort: "desirability", sessionSaved: [], skipped });
    assert.deepEqual(afterSkip, [2, 3, 5, 4]);

    const saved = noteSaved([], 4);
    const closed = sample.map((question) => (question.row === 4 ? { ...question, open: false } : question));
    const afterSave = orderQuestionRows({ questions: closed, sort: "desirability", sessionSaved: saved, skipped: [] });
    assert.deepEqual(afterSave, [4, 2, 3, 5]);
  });

  it("reads desirability and match from the matching application", () => {
    const applications = [
      {
        company: "Quietpine Mail Pharmacy",
        role: "Remote Medication Therapy Pharmacist",
        score: 149,
        matchScore: 85,
        dateApplied: "2026-10-01",
      },
      {
        company: "Highdesert Therapy Group",
        role: "Remote Medication Therapy Pharmacist",
        score: 194,
        matchScore: 94,
        dateApplied: "2026-10-02",
      },
    ];
    assert.deepEqual(scoresForJob("Quietpine Mail Pharmacy — Remote Medication Therapy Pharmacist", applications), {
      score: 149,
      matchScore: 85,
    });
    assert.deepEqual(scoresForJob("Unknown Clinic — Night Pharmacist", applications), {
      score: null,
      matchScore: null,
    });
  });

  it("sorts column A dates and uses a later sheet row when the date ties or is missing", () => {
    const sameDay = [
      row(2, "2026-10-01", 10, 10, true, "Alpha — Role"),
      row(9, "2026-10-01", 10, 10, true, "Beta — Role"),
    ];
    assert.equal(compareQuestionRecency(sameDay[1], sameDay[0]) > 0, true);
    assert.deepEqual(
      orderQuestionRows({ questions: sameDay, sort: "newest", sessionSaved: [], skipped: [] }),
      [9, 2],
    );
    assert.deepEqual(
      orderQuestionRows({ questions: sameDay, sort: "oldest", sessionSaved: [], skipped: [] }),
      [2, 9],
    );

    const missing = [
      row(3, "2026-10-20", 10, 10, true, "Gamma — Role"),
      row(4, "not a date", 10, 10, true, "Delta — Role"),
      row(8, "", 10, 10, true, "Epsilon — Role"),
    ];
    assert.equal(compareQuestionRecency(missing[1], missing[0]) > 0, true);
    assert.deepEqual(
      orderQuestionRows({ questions: missing, sort: "newest", sessionSaved: [], skipped: [] }),
      [8, 4, 3],
    );

    const clock = [
      row(2, "2026-10-30 1:00 PM ET", 10, 10, true, "Morning — Role"),
      row(4, "2026-10-27", 10, 10, true, "Earlier — Role"),
      row(3, "2026-10-30 3:22 PM ET", 10, 10, true, "Afternoon — Role"),
      row(9, "2026-10-30 3:22 PM ET", 10, 10, true, "Same minute — Role"),
    ];
    assert.deepEqual(
      orderQuestionRows({ questions: clock, sort: "newest", sessionSaved: [], skipped: [] }),
      [9, 3, 2, 4],
    );
    assert.deepEqual(
      orderQuestionRows({ questions: clock, sort: "oldest", sessionSaved: [], skipped: [] }),
      [4, 2, 3, 9],
    );
  });

  it("groups open rows for one job and keeps Done rows out", () => {
    const linkedIn =
      "Northwind Collective - Senior Onboarding Manager, AI SaaS (Match 76, Remote US; LinkedIn Easy Apply) https://www.linkedin.com/jobs/view/4484073489/";
    const linkedInAgain =
      "northwind collective — Senior Onboarding Manager, AI SaaS (Match 70) https://www.linkedin.com/jobs/view/4484073489/";
    const otherPosting =
      "Northwind Collective - Senior Onboarding Manager, AI SaaS (Match 76) https://www.linkedin.com/jobs/view/9990001111/";
    const firstRound = "Harborlane - Product Ops Lead (82, NYC 4 days/wk, $165-190K)";
    const followUp = "Harborlane — Product Ops Lead (Match 82, NYC in office 4 days/wk, $165-190K + equity/bonus)";
    assert.equal(jobGroupKey(linkedIn), jobGroupKey(linkedInAgain));
    assert.notEqual(jobGroupKey(linkedIn), jobGroupKey(otherPosting));
    assert.equal(jobGroupKey(firstRound), jobGroupKey(followUp));

    const questions = [
      row(2, "2026-10-01", 80, 82, true, firstRound),
      row(3, "2026-10-01", 80, 82, false, followUp),
      row(6, "2026-10-08", 80, 82, true, followUp),
      row(4, "2026-10-02", 70, 76, true, linkedIn),
      row(5, "2026-10-03", 70, 76, true, linkedInAgain),
      row(7, "2026-10-04", 70, 76, true, otherPosting),
    ];
    questions[1] = { ...questions[1], editable: false, open: false };
    const cards = buildJobCards(questions);
    const harbor = cards.find((card) => card.key === jobGroupKey(firstRound));
    const northwind = cards.find((card) => card.key === jobGroupKey(linkedIn));
    assert.ok(harbor);
    assert.deepEqual(harbor.questions.map((question) => question.row), [2, 6]);
    assert.ok(northwind);
    assert.deepEqual(northwind.questions.map((question) => question.row), [4, 5]);
    assert.equal(cards.some((card) => card.questions.some((question) => question.row === 3)), false);
    assert.equal(cards.some((card) => card.key === jobGroupKey(otherPosting)), true);
  });

  it("gives the demo questions four different stack orders", () => {
    const data = buildDemoDashboard(new Date("2026-10-30T16:00:00-04:00"));
    const questions: RankedQuestion[] = data.questions.map((question) => {
      const scores = scoresForJob(question.job, data.applications);
      return {
        row: question.row,
        date: question.date,
        job: question.job,
        score: scores.score,
        matchScore: scores.matchScore,
        editable: true,
        open: true,
      };
    });
    const orders = (["newest", "oldest", "desirability", "match"] as const).map((sort) =>
      orderQuestionRows({ questions, sort, sessionSaved: [], skipped: [] }).join(","),
    );
    assert.equal(new Set(orders).size, 4);
    const first = (sort: QuestionSort) => {
      const rowNumber = orderQuestionRows({ questions, sort, sessionSaved: [], skipped: [] })[0];
      return data.questions.find((question) => question.row === rowNumber)?.job;
    };
    assert.equal(first("newest")?.startsWith("Solstice"), true);
    assert.equal(first("oldest")?.startsWith("Lantern"), true);
    assert.equal(first("desirability")?.startsWith("Highdesert"), true);
    assert.equal(first("match")?.startsWith("Lantern"), true);
  });
});

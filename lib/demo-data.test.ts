import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOpenStatus } from "./applications";
import {
  DEMO_PERSONA,
  DEMO_PERSONA_LINE,
  buildDemoDashboard,
  demoQuestions,
} from "./demo-data";
import { configuredPassword, isDemoMode } from "./mode";

const FORBIDDEN = [
  "genevieve",
  "gmail",
  "vercel",
  "gserviceaccount",
  "cvs",
  "walgreens",
  "kaiser",
  "walmart",
  "amazon",
  "rite aid",
  "optum",
];

describe("demo fixture", () => {
  const now = new Date("2026-10-17T16:00:00-04:00");
  const data = buildDemoDashboard(now);

  it("fills the tracker with a fictional pharmacist search", () => {
    assert.equal(data.source, "demo");
    assert.equal(data.persona, DEMO_PERSONA_LINE);
    assert.equal(data.persona?.includes(DEMO_PERSONA), true);
    assert.equal(data.serviceAccountEmail, undefined);
    assert.equal(data.spreadsheetUrl, undefined);
    assert.equal(data.applications.length >= 15 && data.applications.length <= 20, true);
    assert.equal(data.summary.total, data.applications.length);
    assert.equal(data.summary.top.length > 0, true);
    assert.equal(data.scoring.length > 0, true);
    const statuses = new Set(data.applications.map((job) => job.status));
    assert.equal(statuses.has("Interview"), true);
    assert.equal(statuses.has("Applied"), true);
    assert.equal(data.applications.some((job) => job.salary.includes("$")), true);
  });

  it("mixes ZipRecruiter and LinkedIn on about five open questions", () => {
    const questions = demoQuestions(now);
    const open = questions.filter((question) => isOpenStatus(question.status));
    assert.equal(questions.length, 5);
    assert.equal(open.length, 5);
    assert.equal(questions.some((question) => question.source === "ZipRecruiter"), true);
    assert.equal(questions.some((question) => question.source === "LinkedIn"), true);
  });

  it("does not contain real employers, addresses, or secrets", () => {
    const blob = JSON.stringify(data).toLowerCase();
    for (const word of FORBIDDEN) {
      assert.equal(blob.includes(word), false, word);
    }
    assert.equal(blob.includes("@"), false);
    assert.equal(blob.includes("webhook_url"), false);
    assert.equal(blob.includes("webhook_key"), false);
    assert.equal(blob.includes("private_key"), false);
  });
});

describe("demo mode switch", () => {
  it("uses the demo password only when APP_MODE is demo", () => {
    const previous = {
      APP_MODE: process.env.APP_MODE,
      DASHBOARD_PASSWORD: process.env.DASHBOARD_PASSWORD,
      DEMO_PASSWORD: process.env.DEMO_PASSWORD,
    };
    try {
      process.env.DASHBOARD_PASSWORD = "placeholder-real";
      process.env.DEMO_PASSWORD = "placeholder-demo";
      delete process.env.APP_MODE;
      assert.equal(isDemoMode(), false);
      assert.equal(configuredPassword(), "placeholder-real");

      process.env.APP_MODE = "demo";
      assert.equal(isDemoMode(), true);
      assert.equal(configuredPassword(), "placeholder-demo");

      delete process.env.DEMO_PASSWORD;
      assert.equal(configuredPassword(), "");
    } finally {
      if (previous.APP_MODE === undefined) delete process.env.APP_MODE;
      else process.env.APP_MODE = previous.APP_MODE;
      if (previous.DASHBOARD_PASSWORD === undefined) delete process.env.DASHBOARD_PASSWORD;
      else process.env.DASHBOARD_PASSWORD = previous.DASHBOARD_PASSWORD;
      if (previous.DEMO_PASSWORD === undefined) delete process.env.DEMO_PASSWORD;
      else process.env.DEMO_PASSWORD = previous.DEMO_PASSWORD;
    }
  });
});

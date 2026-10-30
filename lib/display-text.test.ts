import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLY_LINK_LABEL,
  asksForDirectApply,
  firstUrl,
  isApplicationLinkField,
  presentQuestionText,
  splitDisplayText,
} from "./display-text";

const LONG_URL =
  "https://example.com/jobs/willowbrook/clinical-pharmacist/panel-interview-cedar-hollow-anticoagulation-cases-residency-project";

describe("display text", () => {
  it("strips a posting URL that is not an apply prompt", () => {
    const display = splitDisplayText(
      `They offered a panel interview Thursday at 2pm Mountain. The posting is ${LONG_URL}. Should I accept?`,
    );
    assert.equal(display.applyHref, null);
    assert.equal(display.text.includes("http"), false);
    assert.equal(display.text.includes("example.com"), false);
    assert.equal(
      display.text,
      "They offered a panel interview Thursday at 2pm Mountain. Should I accept?",
    );
  });

  it("keeps a direct-apply prompt as a labeled link and hides the raw address", () => {
    const href = "https://example.com/jobs/quietpine/remote-medication-therapy-pharmacist/apply-yourself-on-the-company-site";
    const display = splitDisplayText(`I could not submit this application. Please apply directly: ${href}`);
    assert.equal(display.applyHref, href);
    assert.equal(display.text.includes("http"), false);
    assert.equal(display.text, "I could not submit this application. Please apply directly:");
    assert.equal(APPLY_LINK_LABEL, "Apply on company site");
  });

  it("leaves text without a URL unchanged and recognizes the application link field", () => {
    assert.deepEqual(splitDisplayText("Should I enter 158000?"), {
      text: "Should I enter 158000?",
      applyHref: null,
    });
    assert.equal(firstUrl(`See ${LONG_URL}.`), LONG_URL);
    assert.equal(isApplicationLinkField("Application Link"), true);
    assert.equal(isApplicationLinkField("Verification Notes"), false);
  });

  it("recognizes only the direct-apply phrases", () => {
    const phrases = [
      "apply directly",
      "apply yourself",
      "manual apply",
      "couldn't submit",
      "could not submit",
      "blocked",
      "captcha",
      "security check",
      "can't get past",
      "cannot get past",
      "please submit on the company site",
    ];
    for (const phrase of phrases) {
      assert.equal(asksForDirectApply(`Note: ${phrase}.`), true, phrase);
    }
    assert.equal(asksForDirectApply("What should I enter for the work-authorization question?"), false);
    assert.equal(asksForDirectApply("Please apply on Thursday if you can."), false);
    assert.equal(asksForDirectApply("The form isn't filled yet."), false);
  });

  it("strips a posting line and a spaced period, and labels an apply page only for a direct apply", () => {
    const posting =
      "https://www.ziprecruiter.com/jobs-search?search=Product+Manager&location=Remote+%28USA%29&days=1&lk=exampleToken0123456789";
    const apply = "https://jobs.ashbyhq.com/example-co/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/application";
    const quiet = splitDisplayText(
      `Ashby form, no account needed. Posting: ${posting} . Apply page: ${apply} One required question has no saved answer. What should I enter?`,
    );
    assert.equal(quiet.applyHref, null);
    assert.equal(quiet.text.includes("http"), false);
    assert.equal(quiet.text.includes("Posting"), false);
    assert.equal(quiet.text.includes("Apply page"), false);
    assert.equal(
      quiet.text,
      "Ashby form, no account needed. One required question has no saved answer. What should I enter?",
    );

    const blocked = splitDisplayText(
      `I couldn't submit this application. A captcha security check blocked the form. Posting: ${posting} . Apply page: ${apply} One required question has no saved answer.`,
    );
    assert.equal(blocked.applyHref, apply);
    assert.equal(blocked.text.includes("http"), false);
    assert.equal(blocked.text.includes("ziprecruiter"), false);
    assert.equal(blocked.text.includes("ashbyhq"), false);
    assert.equal(
      blocked.text,
      "I couldn't submit this application. A captcha security check blocked the form. One required question has no saved answer.",
    );
    assert.equal(APPLY_LINK_LABEL, "Apply on company site");
  });

  it("strips a workday application url unless the question asks for a direct apply", () => {
    const url = "https://example.wd5.myworkdayjobs.com/example-co/job/remote/pharmacist/application";
    const quiet = splitDisplayText(`See ${url} for the form fields.`);
    assert.equal(quiet.applyHref, null);
    assert.equal(quiet.text.includes("http"), false);
    assert.equal(quiet.text, "See for the form fields.");
    const asked = splitDisplayText(`I could not submit this application. Apply page: ${url}`);
    assert.equal(asked.applyHref, url);
    assert.equal(asked.text.includes("http"), false);
    assert.equal(asked.text.includes("Apply page"), false);
    assert.equal(asked.text, "I could not submit this application.");
  });

  it("strips an apply-page address when the question is not asking for a direct apply", () => {
    const apply = "https://jobs.greenhouse.io/example-co/jobs/123/application";
    const display = splitDisplayText(`The screener sent a note. Apply page: ${apply} They asked about weekends.`);
    assert.equal(display.applyHref, null);
    assert.equal(display.text.includes("http"), false);
    assert.equal(display.text.includes("Apply page"), false);
    assert.equal(display.text, "The screener sent a note. They asked about weekends.");
  });

  it("uses Link only when the question asks for a direct apply", () => {
    const column = "https://jobs.lever.co/example-co/11111111-2222-4333-8444-555555555555";
    const apply = "https://jobs.ashbyhq.com/example-co/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/application";
    const posting =
      "https://www.ziprecruiter.com/jobs-search?search=Product+Manager&location=Remote+%28USA%29&days=1&lk=exampleToken0123456789";

    const ordinary = presentQuestionText("What should I enter for the work-authorization question?", column);
    assert.equal(ordinary.applyHref, null);
    assert.equal(ordinary.text, "What should I enter for the work-authorization question?");

    const fromColumn = presentQuestionText(
      "I can't get past the login wall. Please apply directly.",
      column,
    );
    assert.equal(fromColumn.applyHref, column);
    assert.equal(fromColumn.text.includes("http"), false);

    const fromText = presentQuestionText(
      `Manual apply. Posting: ${posting} . Apply page: ${apply}`,
      "",
    );
    assert.equal(fromText.applyHref, apply);
    assert.equal(fromText.text.includes("http"), false);
    assert.equal(fromText.text.includes("Posting"), false);
    assert.equal(fromText.text.includes("Apply page"), false);
    assert.equal(fromText.text, "Manual apply.");
  });
});

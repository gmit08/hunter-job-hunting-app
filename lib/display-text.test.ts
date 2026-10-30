import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APPLY_LINK_LABEL, firstUrl, isApplicationLinkField, presentQuestionText, splitDisplayText } from "./display-text";

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

  it("strips a posting line and a spaced period, and keeps an apply page only as a labeled link", () => {
    const posting =
      "https://www.ziprecruiter.com/jobs-search?search=Product+Manager&location=Remote+%28USA%29&days=1&lk=exampleToken0123456789";
    const apply = "https://jobs.ashbyhq.com/example-co/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/application";
    const display = splitDisplayText(
      `Ashby form, no account needed, no save-draft (so the form isn't filled yet). Posting: ${posting} . Apply page: ${apply} One required question has no saved answer. What should I enter?`,
    );
    assert.equal(display.applyHref, apply);
    assert.equal(display.text.includes("http"), false);
    assert.equal(display.text.includes("ziprecruiter"), false);
    assert.equal(display.text.includes("ashbyhq"), false);
    assert.equal(display.text.includes("Posting"), false);
    assert.equal(display.text.includes("Apply page"), false);
    assert.equal(display.text.includes(posting), false);
    assert.equal(
      display.text,
      "Ashby form, no account needed, no save-draft (so the form isn't filled yet). One required question has no saved answer. What should I enter?",
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

  it("uses the Link column when it has a URL and falls back to the question text when it does not", () => {
    const column = "https://jobs.lever.co/example-co/11111111-2222-4333-8444-555555555555";
    const posting =
      "https://www.ziprecruiter.com/jobs-search?search=Product+Manager&location=Remote+%28USA%29&days=1&lk=exampleToken0123456789";
    const fromColumn = presentQuestionText("What should I enter for work authorization?", column);
    assert.equal(fromColumn.applyHref, column);
    assert.equal(fromColumn.text, "What should I enter for work authorization?");

    const blank = presentQuestionText(
      `Posting: ${posting} . Should I accept the Thursday panel?`,
      "  ",
    );
    assert.equal(blank.applyHref, null);
    assert.equal(blank.text.includes("http"), false);
    assert.equal(blank.text.includes("Posting"), false);
    assert.equal(blank.text, "Should I accept the Thursday panel?");

    const missing = presentQuestionText("Should I enter 158000?", undefined);
    assert.deepEqual(missing, { text: "Should I enter 158000?", applyHref: null });
  });
});

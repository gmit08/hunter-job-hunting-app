import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APPLY_LINK_LABEL, firstUrl, isApplicationLinkField, splitDisplayText } from "./display-text";

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
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("question card controls", () => {
  it("renders Next beside Back on every pointer, not only on a coarse one", () => {
    const source = readFileSync(new URL("../components/question-wizard.tsx", import.meta.url), "utf8");
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const next = source.match(/<Button type="button" className="wizard-next[\s\S]*?<\/Button>/);
    assert.ok(next);
    assert.equal(next[0].includes("wizard-touch-actions"), false);
    assert.equal(next[0].includes("Next"), true);
    assert.equal(source.includes("Enter sends this card"), true);
    assert.equal(source.includes("submitCard(cardQuestions, current.key)"), true);
    assert.equal(/\.wizard-next\s*\{[^}]*display:\s*none/.test(css), false);
    assert.match(css, /\.wizard-touch-actions,\s*\n\.wizard-touch-hint/);
  });
});

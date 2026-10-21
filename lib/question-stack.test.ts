import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcileOrder, skipToBack } from "./question-stack";

describe("question card stack", () => {
  it("moves a skipped card to the back and leaves the count unchanged", () => {
    const order = [5, 6, 7];
    const skipped = skipToBack(order);
    assert.deepEqual(skipped, [6, 7, 5]);
    assert.equal(skipped.length, order.length);
    assert.deepEqual([...skipped].sort(), [...order].sort());
  });

  it("keeps cycling when every remaining card has been skipped", () => {
    let order = [5, 6];
    order = skipToBack(order);
    assert.deepEqual(order, [6, 5]);
    order = skipToBack(order);
    assert.deepEqual(order, [5, 6]);
    assert.equal(order.length, 2);
  });

  it("leaves a single skipped card in place", () => {
    assert.deepEqual(skipToBack([8]), [8]);
    assert.equal(skipToBack([8]).length, 1);
  });

  it("drops answered rows and keeps a skipped card in the session order", () => {
    const afterSkip = skipToBack([5, 6, 7]);
    const stillOpen = reconcileOrder(afterSkip, [6, 7]);
    assert.deepEqual(stillOpen, [6, 7]);
    assert.equal(stillOpen.length, 2);
  });

  it("appends a new open question behind cards already in the session", () => {
    assert.deepEqual(reconcileOrder([6, 5], [5, 6, 9]), [6, 5, 9]);
  });
});

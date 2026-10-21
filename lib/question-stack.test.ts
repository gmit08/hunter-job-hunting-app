import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildWizardOrder,
  cursorAfterSave,
  cursorAfterSkip,
  enterInsertsNewline,
  initialCursor,
  noteSaved,
  noteSkipped,
  previousIndex,
  type WizardSheetRow,
} from "./question-stack";

const sheet: WizardSheetRow[] = [
  { row: 2, editable: true, open: true },
  { row: 3, editable: true, open: true },
  { row: 4, editable: true, open: false },
  { row: 5, editable: false, open: false },
];

describe("question card stack", () => {
  it("starts on the first open card, with saved-but-unsent rows behind it and done rows left out", () => {
    const order = buildWizardOrder({ sheetRows: sheet, sessionSaved: [], skipped: [] });
    assert.deepEqual(order, [4, 2, 3]);
    assert.equal(initialCursor(order, new Set([2, 3])), 2);
    assert.equal(order.includes(5), false);
  });

  it("puts this session's saves just before the open cards, newest last", () => {
    const afterFirst = sheet.map((row) => (row.row === 2 ? { ...row, open: false } : row));
    const saved = noteSaved([], 2);
    const order = buildWizardOrder({ sheetRows: afterFirst, sessionSaved: saved, skipped: [] });
    assert.deepEqual(order, [4, 2, 3]);
    assert.equal(cursorAfterSave(order, 2, new Set([3])), 3);

    const afterBoth = afterFirst.map((row) => (row.row === 3 ? { ...row, open: false } : row));
    const both = noteSaved(saved, 3);
    const finished = buildWizardOrder({ sheetRows: afterBoth, sessionSaved: both, skipped: [] });
    assert.deepEqual(finished, [4, 2, 3]);
    assert.equal(cursorAfterSave(finished, 3, new Set()), "complete");
    assert.equal(finished[previousIndex(finished, "complete") ?? -1], 3);
    assert.equal(finished[previousIndex(finished, 3) ?? -1], 2);
    assert.equal(finished[previousIndex(finished, 2) ?? -1], 4);
    assert.equal(previousIndex(finished, 4), null);
  });

  it("moves a re-saved card to the end of this session's saves", () => {
    const closed = sheet.map((row) => (row.open ? { ...row, open: false } : row));
    const resaved = noteSaved([2, 3], 2);
    assert.deepEqual(resaved, [3, 2]);
    assert.deepEqual(
      buildWizardOrder({ sheetRows: closed, sessionSaved: resaved, skipped: [] }),
      [4, 3, 2],
    );
  });

  it("moves a skipped open card to the back and keeps cycling without changing the open set", () => {
    const start = buildWizardOrder({ sheetRows: sheet, sessionSaved: [], skipped: [] });
    const open = new Set([2, 3]);
    const once = noteSkipped([], 2);
    const afterFirst = buildWizardOrder({ sheetRows: sheet, sessionSaved: [], skipped: once });
    assert.deepEqual(afterFirst, [4, 3, 2]);
    assert.equal(cursorAfterSkip(start, afterFirst, 2, open), 3);
    assert.equal(afterFirst.filter((row) => open.has(row)).length, 2);

    const twice = noteSkipped(once, 3);
    const afterSecond = buildWizardOrder({ sheetRows: sheet, sessionSaved: [], skipped: twice });
    assert.deepEqual(afterSecond, [4, 2, 3]);
    assert.equal(cursorAfterSkip(afterFirst, afterSecond, 3, open), 2);
  });

  it("leaves a single skipped card in place", () => {
    const only: WizardSheetRow[] = [
      { row: 2, editable: true, open: true },
      { row: 4, editable: true, open: false },
    ];
    const start = buildWizardOrder({ sheetRows: only, sessionSaved: [], skipped: [] });
    const next = buildWizardOrder({ sheetRows: only, sessionSaved: [], skipped: noteSkipped([], 2) });
    assert.deepEqual(start, [4, 2]);
    assert.deepEqual(next, [4, 2]);
    assert.equal(cursorAfterSkip(start, next, 2, new Set([2])), 2);
  });

  it("appends a new open question behind the session, and behind cards already skipped", () => {
    const withNew = [...sheet, { row: 9, editable: true, open: true }];
    assert.deepEqual(
      buildWizardOrder({ sheetRows: withNew, sessionSaved: [2], skipped: [] }).filter((row) => row !== 4),
      [2, 3, 9],
    );
    assert.deepEqual(buildWizardOrder({ sheetRows: withNew, sessionSaved: [], skipped: [2] }), [4, 3, 9, 2]);
  });

  it("inserts a newline for Shift+Enter and for a coarse pointer", () => {
    assert.equal(enterInsertsNewline(false, false), false);
    assert.equal(enterInsertsNewline(false, true), true);
    assert.equal(enterInsertsNewline(true, false), true);
    assert.equal(enterInsertsNewline(true, true), true);
  });
});

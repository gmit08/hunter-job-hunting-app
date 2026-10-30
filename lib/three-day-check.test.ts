import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPLETED_CELL_LABEL,
  DEFAULT_COMPLETED_CELL,
  QUESTIONS_UPDATED_TOAST,
  THREE_DAY_CHECK_ERROR_TOAST,
  completionIsNewer,
  parseCompletedCell,
  parseCompletionTimestamp,
} from "./three-day-check";

describe("3-day check completion cell", () => {
  it("defaults to Dashboard Control B2 and leaves the pause cell alone", () => {
    const cell = parseCompletedCell(undefined);
    assert.deepEqual(cell, { tab: "Dashboard Control", cell: "B2" });
    assert.equal(DEFAULT_COMPLETED_CELL, "Dashboard Control!B2");
    assert.equal(COMPLETED_CELL_LABEL, "Last 3-day check completed");
    assert.notEqual(cell?.cell, "B1");
    assert.notEqual(cell?.cell, "A1");
  });

  it("reads a quoted tab and a custom cell", () => {
    assert.deepEqual(parseCompletedCell("'Dashboard Control'!$B$2"), {
      tab: "Dashboard Control",
      cell: "B2",
    });
    assert.deepEqual(parseCompletedCell("Notes!C4"), { tab: "Notes", cell: "C4" });
    assert.equal(parseCompletedCell("B2"), null);
    assert.equal(parseCompletedCell("Dashboard Control!B2:C2"), null);
  });

  it("accepts an ISO-8601 timestamp and a Sheets date-time serial", () => {
    const iso = "2026-10-28T02:19:00.000Z";
    assert.equal(parseCompletionTimestamp(iso), Date.parse(iso));
    assert.equal(parseCompletionTimestamp("2026-10-28T02:19:00Z"), Date.parse("2026-10-28T02:19:00Z"));
    assert.equal(parseCompletionTimestamp(25569), Date.parse("1970-01-01T00:00:00.000Z"));
    assert.equal(parseCompletionTimestamp(25569.5), Date.parse("1970-01-01T12:00:00.000Z"));
    assert.equal(parseCompletionTimestamp("2026-10-28 2:19 AM ET"), Date.parse("2026-10-28T06:19:00.000Z"));
  });

  it("rejects pause values, date-only text, and blank cells", () => {
    assert.equal(parseCompletionTimestamp("TRUE"), null);
    assert.equal(parseCompletionTimestamp(true), null);
    assert.equal(parseCompletionTimestamp(false), null);
    assert.equal(parseCompletionTimestamp("Paused"), null);
    assert.equal(parseCompletionTimestamp("2026-10-28"), null);
    assert.equal(parseCompletionTimestamp(""), null);
    assert.equal(parseCompletionTimestamp(null), null);
  });

  it("treats only a timestamp newer than the click as completion", () => {
    const clickedAt = Date.parse("2026-10-28T02:19:00.000Z");
    assert.equal(completionIsNewer("2026-10-28T02:19:05.000Z", clickedAt), true);
    assert.equal(completionIsNewer("2026-10-28T02:19:00.000Z", clickedAt), false);
    assert.equal(completionIsNewer("2026-10-28T02:18:00.000Z", clickedAt), false);
    assert.equal(completionIsNewer(null, clickedAt), false);
    assert.equal(QUESTIONS_UPDATED_TOAST, "Questions Updated");
    assert.equal(THREE_DAY_CHECK_ERROR_TOAST, "Error. Try again later.");
  });
});

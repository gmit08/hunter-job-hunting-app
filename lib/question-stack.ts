export type WizardSheetRow = {
  row: number;
  editable: boolean;
  open: boolean;
};

export function buildWizardOrder(input: {
  sheetRows: WizardSheetRow[];
  sessionSaved: number[];
  skipped: number[];
}): number[] {
  const editable = input.sheetRows.filter((item) => item.editable);
  const byRow = new Map(editable.map((item) => [item.row, item]));
  const sessionSaved = input.sessionSaved.filter((row) => byRow.has(row));
  const sessionSet = new Set(sessionSaved);
  const skipped = input.skipped.filter((row) => {
    const item = byRow.get(row);
    return item?.open === true && !sessionSet.has(row);
  });
  const skippedSet = new Set(skipped);

  const priorAnswered = editable
    .filter((item) => !item.open && !sessionSet.has(item.row))
    .map((item) => item.row);
  const openSheet = editable
    .filter((item) => item.open && !sessionSet.has(item.row) && !skippedSet.has(item.row))
    .map((item) => item.row);

  return [...priorAnswered, ...sessionSaved, ...openSheet, ...skipped];
}

export function initialCursor(order: number[], openRows: ReadonlySet<number>): number | null {
  return order.find((row) => openRows.has(row)) ?? null;
}

export function previousIndex(order: number[], cursor: number | "complete"): number | null {
  if (order.length === 0) return null;
  if (cursor === "complete") return order.length - 1;
  const index = order.indexOf(cursor);
  if (index <= 0) return null;
  return index - 1;
}

export function cursorAfterSave(
  order: number[],
  savedRow: number,
  openRows: ReadonlySet<number>,
): number | "complete" {
  const index = order.indexOf(savedRow);
  const after = index >= 0 ? order.slice(index + 1) : order;
  const next = after.find((row) => openRows.has(row));
  if (next != null) return next;
  const wrap = order.find((row) => openRows.has(row));
  if (wrap != null) return wrap;
  return "complete";
}

export function cursorAfterSkip(
  oldOrder: number[],
  newOrder: number[],
  skippedRow: number,
  openRows: ReadonlySet<number>,
): number {
  const index = oldOrder.indexOf(skippedRow);
  const after = index >= 0 ? oldOrder.slice(index + 1) : [];
  const next = after.find((row) => openRows.has(row) && row !== skippedRow && newOrder.includes(row));
  if (next != null) return next;
  const wrap = newOrder.find((row) => openRows.has(row) && row !== skippedRow);
  if (wrap != null) return wrap;
  return skippedRow;
}

export function noteSaved(sessionSaved: number[], row: number): number[] {
  return [...sessionSaved.filter((item) => item !== row), row];
}

export function noteSkipped(skipped: number[], row: number): number[] {
  return [...skipped.filter((item) => item !== row), row];
}

export function enterInsertsNewline(coarsePointer: boolean, shiftKey: boolean): boolean {
  if (shiftKey) return true;
  return coarsePointer;
}

export function usesCoarsePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

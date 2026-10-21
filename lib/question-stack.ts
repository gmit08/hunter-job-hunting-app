export function reconcileOrder(sessionOrder: number[], openRows: number[]): number[] {
  const open = new Set(openRows);
  const kept = sessionOrder.filter((row) => open.has(row));
  const seen = new Set(kept);
  return [...kept, ...openRows.filter((row) => !seen.has(row))];
}

export function skipToBack(order: number[]): number[] {
  if (order.length < 2) return [...order];
  return [...order.slice(1), order[0]];
}

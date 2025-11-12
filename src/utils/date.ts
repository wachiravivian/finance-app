// src/utils/date.ts
export function getMonthKey(d = new Date()) {
  // "YYYY-MM"
  return d.toISOString().slice(0, 7);
}

export function monthRange(monthKey: string) {
  // monthKey: "YYYY-MM"
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, 1, 0, 0, 0)); // exclusive
  return { start: start.toISOString(), end: end.toISOString() };
}

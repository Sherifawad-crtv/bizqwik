import { DOW, MON, splitMonth, fmt } from "../design-system/format";

export { fmt, splitMonth, monthLabel, monthAbbr, daysInMonth, isoDate, dateLabel, weekdayOf, initialsOf } from "../design-system/format";

export function egp(n: number): string {
  return `${fmt(n)} EGP`;
}

export function monthShort(month: string): string {
  const [y, m] = splitMonth(month);
  return `${MON[m].toUpperCase()} ${String(y).slice(2)}`;
}

export function dateLabelFull(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DOW[date.getDay()]}, ${MON[m - 1]} ${d} ${y}`;
}

export function nowMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Session stamps are a rule (scan vs added later): see shared/domain/sessionStamp.ts.
export { clockLabel, sessionStamp } from "./domain/sessionStamp";

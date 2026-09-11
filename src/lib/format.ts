const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

export function egp(n: number): string {
  return `${fmt(n)} EGP`;
}

/** month key "2026-09" -> [year, monthIndex(0-based)] */
export function splitMonth(month: string): [number, number] {
  const [y, m] = month.split("-").map(Number);
  return [y, m - 1];
}

export function monthLabel(month: string): string {
  const [y, m] = splitMonth(month);
  return `${MON_FULL[m]} ${y}`;
}

export function monthShort(month: string): string {
  const [y, m] = splitMonth(month);
  return `${MON[m].toUpperCase()} ${String(y).slice(2)}`;
}

export function monthAbbr(month: string): string {
  const [, m] = splitMonth(month);
  return MON[m].toUpperCase();
}

export function daysInMonth(month: string): number {
  const [y, m] = splitMonth(month);
  return new Date(y, m + 1, 0).getDate();
}

export function isoDate(month: string, day: number): string {
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function dateLabel(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DOW[date.getDay()]}, ${MON[m - 1]} ${d}`;
}

export function dateLabelFull(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DOW[date.getDay()]}, ${MON[m - 1]} ${d} ${y}`;
}

export function weekdayOf(month: string, day: number): number {
  const [y, m] = splitMonth(month);
  return new Date(y, m, day).getDay();
}

export function nowMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Display formatting the design system's components need: numbers, months,
// dates, initials and clock times. Pure functions. shared/format and
// shared/classTime re-export these, so app code can keep importing them there.

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
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

export function weekdayOf(month: string, day: number): number {
  const [y, m] = splitMonth(month);
  return new Date(y, m, day).getDay();
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export const pad = (n: number) => String(n).padStart(2, "0");

/** "18:30" → "6:30 PM". */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const am = h < 12;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${am ? "AM" : "PM"}`;
}

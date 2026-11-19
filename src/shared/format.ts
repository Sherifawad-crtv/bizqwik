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

const GYM_TZ = "Africa/Cairo";
/** "8:42 PM" in the gym's time. */
export function clockLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: GYM_TZ, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}
function gymDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: GYM_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
/** What to show for when a session was recorded. A scan is always on its own
 * day, so it shows the time ("8:42 PM"). Anything recorded on a later day (added
 * by hand afterwards) says when it was added instead, so it can't pass for a
 * scan. Null when there's no timestamp. */
export function sessionStamp(s: { date: string; createdAt?: string | null; source?: string }): { text: string; scan: boolean } | null {
  if (!s.createdAt) return null;
  const sameDay = gymDay(s.createdAt) === s.date;
  if (s.source === "qr" && sameDay) return { text: clockLabel(s.createdAt), scan: true };
  if (sameDay) return { text: clockLabel(s.createdAt), scan: false };
  const [y, m, d] = gymDay(s.createdAt).split("-").map(Number);
  return { text: `Added ${MON[m - 1]} ${d}${y !== Number(s.date.slice(0, 4)) ? ` ${y}` : ""}`, scan: false };
}

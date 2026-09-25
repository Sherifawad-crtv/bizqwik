// Shared time/weekday helpers for class scheduling screens.

export const pad = (n: number) => String(n).padStart(2, "0");

export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const am = h < 12;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${am ? "AM" : "PM"}`;
}

export function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${date} · ${timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}

// 0 = Sunday … 6 = Saturday (JS getDay). Shown Saturday-first, the working
// week most of our gyms run on.
export const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5];
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Sat · Mon · Wed", or "Every day". */
export function weekdaysLabel(days: number[]): string {
  if (days.length === 7) return "Every day";
  return WEEKDAY_ORDER.filter((d) => days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(" · ");
}

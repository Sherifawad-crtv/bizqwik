import { MON } from "../../design-system/format";

// When a coach session was recorded, as the coach screens show it: a scan on the
// day shows its time; anything added later says when it was added.

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

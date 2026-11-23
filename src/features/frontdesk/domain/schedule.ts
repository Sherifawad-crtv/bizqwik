import { atLocation } from "../../../shared/locationRules";
import type { ClientWithPackage, GymClass } from "../../../shared/types";
import { addDays, startOfDay } from "./calendar";

// What the desk's schedule, the solo home and guest invites show and allow.
// Pure functions: no React, no server calls.

const HOUR = 3600000;

// ---- Bookings -------------------------------------------------------------------

export type Range = "today" | "tomorrow" | "week" | "all";
type DayGroup = { day: Date; items: GymClass[] };

/** "Today", "Tomorrow", else e.g. "Saturday, Nov 29". */
export function dayHeading(d: Date, today: Date): string {
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/** A class counts as over an hour after it starts. */
export const isOver = (c: GymClass, now: number) => Date.parse(c.startsAt) + HOUR < now;

/** The range's classes at `place`, in the order the desk needs them: what's on
 * now and next, grouped by day; today's finished ones apart (`earlier`); and,
 * when today is over, the next day that has classes (`ahead`). */
export function bookingsView(classes: GymClass[], range: Range, place: string, now: number): { groups: DayGroup[]; earlier: GymClass[]; ahead: DayGroup | null } {
  const today = startOfDay(new Date(now));
  const last = range === "today" ? 1 : range === "tomorrow" ? 2 : range === "week" ? 7 : 366;
  const first = range === "tomorrow" ? 1 : 0;
  const from = addDays(today, first).getTime();
  const to = addDays(today, last).getTime();
  const here = (c: GymClass) => place === "all" || !c.locationId || c.locationId === place;
  const live = classes.filter((c) => c.status !== "cancelled" && Date.parse(c.startsAt) >= from && Date.parse(c.startsAt) < to && here(c));
  const upcoming = live.filter((c) => !isOver(c, now));
  const map = new Map<string, DayGroup>();
  for (const c of upcoming) {
    const d = startOfDay(new Date(c.startsAt));
    const k = d.toISOString();
    if (!map.has(k)) map.set(k, { day: d, items: [] });
    map.get(k)!.items.push(c);
  }
  // Today is over: show the next day that has classes, so the desk sees
  // what's coming instead of an empty page.
  let ahead: DayGroup | null = null;
  if (range === "today" && upcoming.length === 0) {
    const later = classes.filter((c) => c.status !== "cancelled" && Date.parse(c.startsAt) >= to && here(c)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    if (later.length) {
      const day = startOfDay(new Date(later[0].startsAt));
      ahead = { day, items: later.filter((c) => startOfDay(new Date(c.startsAt)).getTime() === day.getTime()) };
    }
  }
  return { groups: [...map.values()], earlier: live.filter((c) => isOver(c, now)), ahead };
}

/** Whether a class is on right now (its first hour). */
export const isHappening = (c: GymClass, now: number) => {
  const start = Date.parse(c.startsAt);
  return start <= now && now < start + HOUR;
};

// ---- Calendar -------------------------------------------------------------------

/** Active classes by local day ("2026-11-23"), each day in start order. */
export function classesByDay(classes: GymClass[], dayKey: (d: Date) => string): Map<string, GymClass[]> {
  const m = new Map<string, GymClass[]>();
  for (const c of classes) {
    if (c.status !== "active") continue;
    const k = dayKey(new Date(c.startsAt));
    m.set(k, [...(m.get(k) ?? []), c].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)));
  }
  return m;
}

// ---- Solo home --------------------------------------------------------------------

/** The next 5 classes still on (started under an hour ago or later) at `here`, plus untied ones. */
export const soloNextUp = (classes: GymClass[], here: string | null, now: number) =>
  classes.filter((c) => c.status !== "cancelled" && Date.parse(c.startsAt) + HOUR >= now).filter((c) => atLocation(c.locationId, here)).slice(0, 5);

/** Members at `here`: all of them, on a running plan, and ending in the next 7 days. */
export function memberCounts(clients: ClientWithPackage[], here: string | null, isActive: (c: ClientWithPackage) => boolean, isEndingSoon: (c: ClientWithPackage) => boolean) {
  const list = clients.filter((c) => atLocation(c.homeLocationId, here));
  return { total: list.length, active: list.filter(isActive).length, soon: list.filter(isEndingSoon).length };
}

type MonthRow = { month: string; revenue: number; payouts: number; profit: number };

/** Revenue per month: one location's payments, or the whole business's report. */
export const revenueMonths = (here: string | null, byMonth: { month: string; revenue: number }[] | undefined, months: MonthRow[] | undefined): MonthRow[] =>
  here ? (byMonth ?? []).map((m) => ({ month: m.month, revenue: m.revenue, payouts: 0, profit: m.revenue })) : (months ?? []);

/** The chart's months (from the first with revenue, at most 12), this month's
 * revenue and its change on last month in % (null with nothing last month). */
export function revenueTrend(months: MonthRow[]) {
  const first = months.findIndex((m) => m.revenue > 0);
  const trend = first < 0 ? months.slice(-1) : months.slice(Math.max(first, months.length - 12));
  const thisMonth = months.at(-1)?.revenue ?? 0;
  const lastMonth = months.at(-2)?.revenue ?? 0;
  const delta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  return { trend, thisMonth, delta };
}

// ---- Guest invitations ----------------------------------------------------------------

/** A guest needs a name, a phone and a visit date that isn't in the past. */
export function checkInvitation(guestName: string, guestPhone: string, visitDate: string, today: string): string | null {
  if (!guestName.trim() || !guestPhone.trim() || !visitDate) return "Guest name, phone and visit date are all required.";
  if (visitDate < today) return "The visit date can't be in the past.";
  return null;
}

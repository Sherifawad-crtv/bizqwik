import type { ClientWithPackage, GymClass } from "../../../shared/types";

// Check-in rules: who can be checked in, why not, and what the desk's home
// shows next. Pure functions: no React, no server calls.

const HOUR = 3600000;

export const hasActivePlan = (c: ClientWithPackage) => !!c.groupPlan || c.currentPackage?.status === "active";

// A class bundle with nothing left can't be checked in on (unless PT covers them).
export const bundleEmpty = (c: ClientWithPackage) => c.groupPlan?.kind === "bundle" && (c.groupPlan.creditsRemaining ?? 0) <= 0;

/** Whether a client can be checked in now, and if not, why. `usedUp` is the
 * server's "used all their sessions" message, when there is one. */
export function checkInState(c: ClientWithPackage, usedUp: string | null, now: number) {
  const ptActive = c.currentPackage?.status === "active";
  const bundle = c.groupPlan?.kind === "bundle" ? c.groupPlan : null;
  const empty = bundleEmpty(c) && !ptActive;
  // A frozen plan can't be checked in on until it restarts (a PT package still can).
  const frozenUntil = c.groupPlan?.frozenUntil && Date.parse(c.groupPlan.frozenUntil) > now && !ptActive ? c.groupPlan.frozenUntil : null;
  const eligible = hasActivePlan(c) && !empty && !usedUp && !frozenUntil;
  return { bundle, empty, frozenUntil, eligible };
}

type PlanRow = { kind: string; name: string; creditsRemaining?: number | null; creditsTotal?: number | null; expiresAt: string };

/** A bundle that ran out is no longer "active", so their latest plan says
 * exactly why they can't check in: still running, but every session used. */
export function usedUpMessage(clientName: string, plans: PlanRow[], now: number): string | null {
  const last = plans[0];
  if (last && last.kind === "bundle" && (last.creditsRemaining ?? 0) <= 0 && Date.parse(last.expiresAt) > now) {
    return `${clientName} has used all ${last.creditsTotal} sessions of ${last.name}.`;
  }
  return null;
}

/** Sessions left after a check-in that used one, or null when none was used. */
export const sessionsLeft = (res: { deducted?: boolean; plan?: { creditsRemaining?: number | null; creditsTotal?: number | null } | null }) =>
  res.deducted && res.plan ? { left: res.plan.creditsRemaining, total: res.plan.creditsTotal } : null;

// ---- The desk's home ------------------------------------------------------------

/** "just now", "5 min ago", "2 hrs ago". */
export function timeAgo(iso: string, now: number): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

/** Today's next classes (up to 3, including one that started under an hour
 * ago); once today is over, the next day that has any, with its label. */
export function nextClasses(classes: GymClass[], now: number): { nextUp: GymClass[]; nextDay: string | null } {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const live = classes.filter((c) => c.status !== "cancelled").sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const today = live.filter((c) => Date.parse(c.startsAt) + HOUR >= now && Date.parse(c.startsAt) <= end.getTime());
  if (today.length) return { nextUp: today.slice(0, 3), nextDay: null };
  const later = live.filter((c) => Date.parse(c.startsAt) > end.getTime());
  if (!later.length) return { nextUp: [], nextDay: null };
  const first = new Date(later[0].startsAt);
  const sameDay = (iso: string) => new Date(iso).toDateString() === first.toDateString();
  const tomorrow = new Date(end.getTime() + 1);
  const label = first.toDateString() === tomorrow.toDateString() ? "Tomorrow" : first.toLocaleDateString(undefined, { weekday: "long" });
  return { nextUp: later.filter((c) => sameDay(c.startsAt)).slice(0, 3), nextDay: label };
}

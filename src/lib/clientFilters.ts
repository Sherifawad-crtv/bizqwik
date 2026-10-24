import type { ClientWithPackage } from "./types";

// Filtering and sorting for the founder's client roster. Everything here is a
// pure function of the client list, so what a filter means is in one place.

export type StatusFilter = "all" | "active" | "low" | "ended" | "none";
export type ExpiryFilter = "any" | "today" | "7" | "14" | "30" | "month" | "custom";
export type SortKey = "name" | "expiry" | "expiry_late" | "left" | "left_most";

export interface ClientFilters {
  q: string;
  status: StatusFilter;
  plan: string; // "" = any, otherwise a plan name
  coach: string; // "" = any, "none" = unassigned, otherwise a coach id
  expiry: ExpiryFilter;
  from: string; // custom range, yyyy-mm-dd
  to: string;
  sort: SortKey;
}

export const LOW_SESSIONS = 3;
export const PT_PACKAGE = "PT package";

export const NO_FILTERS: ClientFilters = { q: "", status: "all", plan: "", coach: "", expiry: "any", from: "", to: "", sort: "name" };

export function isFiltering(f: ClientFilters): boolean {
  return f.q.trim() !== "" || f.status !== "all" || f.plan !== "" || f.coach !== "" || f.expiry !== "any";
}

const DAY = 86400000;
const cairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" });
/** yyyy-mm-dd on the Cairo calendar. */
export function cairoDate(ms: number): string {
  return cairo.format(new Date(ms));
}
const dayNumber = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);

export interface PlanFacts {
  state: "active" | "ended" | "none";
  planNames: string[];
  /** When the plan (or PT package) ends / ended, as a Cairo date. */
  endsOn: string | null;
  /** Whole days from today to endsOn; negative once it has ended. */
  daysLeft: number | null;
  /** Fewest sessions left across active bundles / PT package. */
  left: number | null;
}

export function planFacts(c: ClientWithPackage, nowMs: number): PlanFacts {
  const today = dayNumber(cairoDate(nowMs));
  const g = c.groupPlan ?? null;
  const pkg = c.currentPackage ?? null;
  const pkgActive = pkg && pkg.status === "active" ? pkg : null;

  const ends: string[] = [];
  const lefts: number[] = [];
  const names: string[] = [];
  if (g) {
    names.push(g.name);
    ends.push(cairoDate(Date.parse(g.expiresAt)));
    if (g.kind === "bundle") lefts.push(g.creditsRemaining ?? 0);
  }
  if (pkgActive) {
    names.push(PT_PACKAGE);
    ends.push(pkgActive.expiryDate.slice(0, 10));
    lefts.push(pkgActive.sessionsRemaining);
  }
  if (ends.length > 0) {
    const soonest = ends.reduce((a, b) => (a < b ? a : b));
    return { state: "active", planNames: names, endsOn: soonest, daysLeft: dayNumber(soonest) - today, left: lefts.length ? Math.min(...lefts) : null };
  }

  const last = c.lastGroupPlan ?? null;
  const endedEnds: string[] = [];
  if (last) {
    names.push(last.name);
    endedEnds.push(cairoDate(Date.parse(last.expiresAt)));
  }
  if (pkg) {
    names.push(PT_PACKAGE);
    endedEnds.push(pkg.expiryDate.slice(0, 10));
  }
  if (endedEnds.length > 0) {
    const latest = endedEnds.reduce((a, b) => (a > b ? a : b));
    return { state: "ended", planNames: names, endsOn: latest, daysLeft: dayNumber(latest) - today, left: null };
  }
  return { state: "none", planNames: [], endsOn: null, daysLeft: null, left: null };
}

function matchesExpiry(f: ClientFilters, facts: PlanFacts, nowMs: number): boolean {
  if (f.expiry === "any") return true;
  if (!facts.endsOn || facts.daysLeft === null) return false;
  if (f.expiry === "today") return facts.state === "active" && facts.daysLeft === 0;
  if (f.expiry === "7" || f.expiry === "14" || f.expiry === "30") return facts.state === "active" && facts.daysLeft <= Number(f.expiry);
  if (f.expiry === "month") return facts.endsOn.slice(0, 7) === cairoDate(nowMs).slice(0, 7);
  return (!f.from || facts.endsOn >= f.from) && (!f.to || facts.endsOn <= f.to);
}

export function matchesFilters(c: ClientWithPackage, f: ClientFilters, nowMs: number): boolean {
  const q = f.q.trim().toLowerCase();
  if (q && !`${c.name} ${c.phone ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q)) return false;
  if (f.coach === "none" ? c.assignedCoachId : f.coach && c.assignedCoachId !== f.coach) return false;
  const facts = planFacts(c, nowMs);
  if (f.plan && !facts.planNames.includes(f.plan)) return false;
  if (f.status === "active" && facts.state !== "active") return false;
  if (f.status === "ended" && facts.state !== "ended") return false;
  if (f.status === "none" && facts.state !== "none") return false;
  if (f.status === "low" && !(facts.state === "active" && facts.left !== null && facts.left <= LOW_SESSIONS)) return false;
  return matchesExpiry(f, facts, nowMs);
}

export function filterClients(clients: ClientWithPackage[], f: ClientFilters, nowMs: number = Date.now()): ClientWithPackage[] {
  const rows = clients.filter((c) => matchesFilters(c, f, nowMs)).map((c) => ({ c, facts: planFacts(c, nowMs) }));
  const byName = (a: { c: ClientWithPackage }, b: { c: ClientWithPackage }) => a.c.name.localeCompare(b.c.name);
  // People with nothing to sort on go last, whichever way round.
  const nullsLast = (get: (x: { facts: PlanFacts }) => number | null, dir: 1 | -1) => (a: { c: ClientWithPackage; facts: PlanFacts }, b: { c: ClientWithPackage; facts: PlanFacts }) => {
    const x = get(a);
    const y = get(b);
    if (x === null && y === null) return byName(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    return (x - y) * dir || byName(a, b);
  };
  const endsKey = (x: { facts: PlanFacts }) => (x.facts.endsOn ? dayNumber(x.facts.endsOn) : null);
  const order =
    f.sort === "expiry" ? nullsLast(endsKey, 1)
    : f.sort === "expiry_late" ? nullsLast(endsKey, -1)
    : f.sort === "left" ? nullsLast((x) => x.facts.left, 1)
    : f.sort === "left_most" ? nullsLast((x) => x.facts.left, -1)
    : byName;
  return rows.sort(order).map((r) => r.c);
}

/** The plan names that exist in this roster, with how many clients hold each. */
export function planOptions(clients: ClientWithPackage[], nowMs: number = Date.now()): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of clients) for (const n of planFacts(c, nowMs).planNames) counts.set(n, (counts.get(n) ?? 0) + 1);
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

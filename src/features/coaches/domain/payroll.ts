import { fmt } from "../../../shared/format";
import { canLog } from "../../../shared/types";
import type { Rollup, Session } from "../../../shared/types";

// Payroll rules: who gets paid, month totals, settling and paying.
// Pure functions: no React, no server calls.

export interface MonthRollups {
  month: string;
  rows: Rollup[];
}

// ---- Who's on the payroll ---------------------------------------------------

/** Only roles that log sessions are paid per session. */
export const payees = (rows: Rollup[]) => rows.filter((r) => canLog(r.role));

/** A year of rollups, payees only. */
export const payableYear = (year: MonthRollups[]): MonthRollups[] => year.map((m) => ({ month: m.month, rows: payees(m.rows) }));

export const rowFor = (rows: Rollup[], coachId: string) => rows.find((r) => r.coachId === coachId) ?? null;

// ---- Totals -----------------------------------------------------------------

export const sumTotal = (rows: Rollup[]) => rows.reduce((s, r) => s + r.total, 0);
/** What's still to be paid out of settled months (part payments already taken off). */
export const sumRemaining = (rows: Rollup[]) => rows.reduce((s, r) => s + r.remaining, 0);
export const sumSessions = (rows: Rollup[]) => rows.reduce((s, r) => s + r.count, 0);
export const stillLogging = (rows: Rollup[]) => rows.filter((r) => r.state === "logging").length;

/** A settled month with money already paid out of it. */
export const isPartPaid = (r: Rollup) => r.state === "settled" && r.paidAmount > 0;
export const stateLabel = (r: Rollup) => (isPartPaid(r) ? "PART PAID" : r.state.toUpperCase());

/** How many different days have at least one session. */
export const daysLogged = (sessions: Session[]) => new Set(sessions.map((s) => s.date)).size;
export const sessionsOn = (sessions: Session[], date: string | null) => (date ? sessions.filter((s) => s.date === date) : []);

// ---- To Pay -----------------------------------------------------------------

/** Everything settled but not yet paid, in any month of the year — a month
 * closing doesn't clear what is still owed from it. Oldest first. */
export const dueByMonth = (year: MonthRollups[]) =>
  year.map((m) => ({ month: m.month, rows: m.rows.filter((r) => r.state === "settled") })).filter((m) => m.rows.length > 0);

/** Where a month stands: paid out, still to pay, and still being logged. */
export function monthStatus(rows: Rollup[]) {
  return [
    { state: "paid" as const, total: rows.reduce((s, r) => s + r.paidAmount, 0), n: rows.filter((r) => r.paidAmount > 0).length, label: "Paid out" },
    { state: "settled" as const, total: sumRemaining(rows), n: rows.filter((r) => r.state === "settled").length, label: "Still to pay" },
    { state: "logging" as const, total: sumTotal(rows.filter((r) => r.state === "logging")), n: stillLogging(rows), label: "Still logging" },
  ];
}

/** Paid out so far this year. */
export const paidThisYear = (year: MonthRollups[]) => sumTotal(year.flatMap((m) => m.rows.filter((r) => r.state === "paid")));

/** The History roster: payees, and for the accountant only months already paid. */
export const ledgerRows = (rows: Rollup[], paidOnly: boolean) => rows.filter((r) => canLog(r.role) && (!paidOnly || r.state === "paid"));

// ---- Recording a payment ----------------------------------------------------

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Payment form: an amount up to what's left, paid today or earlier. */
export function checkPayment(amountText: string, date: string, remaining: number, today: string): Checked<{ amount: number }> {
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter the amount you paid." };
  if (amount > remaining) return { ok: false, error: `Only ${fmt(remaining)} EGP is left to pay.` };
  if (!date || date > today) return { ok: false, error: "Choose today or an earlier date." };
  return { ok: true, value: { amount } };
}

/** What would be left to pay after paying `amountText`. */
export const leftAfter = (remaining: number, amountText: string) => {
  const amt = Number(amountText);
  return Number.isFinite(amt) ? remaining - amt : remaining;
};

/** One-tap amounts: group, private or everything — only those that fit what's left. */
export const quickAmounts = (row: Rollup) =>
  [
    { kind: "Group", value: row.groupTotal },
    { kind: "Private", value: row.privateTotal },
    { kind: "All", value: row.remaining },
  ].filter((q) => q.value > 0 && q.value <= row.remaining);

// ---- Logging sessions -------------------------------------------------------

export interface CoachMonth {
  row: Rollup | null;
  sessions: Session[];
}

/** Shows sessions straight away while the server catches up: adds `qty`
 * placeholder sessions on `date` and their pay to the month. Null when there's no row. */
export function withAddedSessions(data: CoachMonth, coachId: string, month: string, date: string, qty: number, now: number): CoachMonth | null {
  if (!data.row) return null;
  const added: Session[] = Array.from({ length: qty }, (_, i) => ({ id: `optimistic-${now}-${i}`, coachId, month, date, createdBy: coachId }));
  const amount = qty * data.row.rate;
  return {
    row: { ...data.row, count: data.row.count + qty, groupTotal: data.row.groupTotal + amount, total: data.row.total + amount },
    sessions: [...data.sessions, ...added],
  };
}

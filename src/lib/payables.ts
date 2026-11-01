import { api, MOCK } from "./backend";
import { currentYearMonths } from "./months";
import { canLog } from "./types";
import type { Rollup } from "./types";

export interface MonthRollups {
  month: string;
  rows: Rollup[];
}

/** Every month of this year up to now, with the coaches who earned in it. The
 * accountant's books are per month, but what is owed doesn't stop at month end. */
export async function loadYearRollups(): Promise<MonthRollups[]> {
  const months = currentYearMonths().filter((m) => m <= MOCK.CURRENT_MONTH);
  const all = await Promise.all(months.map((m) => api.month(m)));
  return months.map((month, i) => ({ month, rows: all[i].rows.filter((r) => canLog(r.role)) }));
}

export const sumTotal = (rows: Rollup[]) => rows.reduce((s, r) => s + r.total, 0);
/** What's still to be paid out of settled months (part payments already taken off). */
export const sumRemaining = (rows: Rollup[]) => rows.reduce((s, r) => s + r.remaining, 0);
/** A settled month with money already paid out of it. */
export const isPartPaid = (r: Rollup) => r.state === "settled" && r.paidAmount > 0;
export const stateLabel = (r: Rollup) => (isPartPaid(r) ? "PART PAID" : r.state.toUpperCase());

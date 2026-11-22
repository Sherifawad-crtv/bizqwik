import { api, MOCK } from "../../../shared/api/backend";
import { callFn } from "../../../shared/api/core";
import { currentYearMonths } from "../../../shared/months";
import type { PackageWithNames, Session, SettlementPayment } from "../../../shared/types";
import type { MonthRollups } from "../domain/payroll";

export type PayMethod = "cash" | "bank" | "instapay";

// Data layer: every server call the coaches feature makes. `month` is shared
// with other code, so it's wrapped; the rest are coaches-only and live here.
export const coachesRepository = {
  /** The month the app treats as "now". */
  currentMonth: MOCK.CURRENT_MONTH,
  /** "YYYY-01".."YYYY-12" for the current year. */
  yearMonths: () => currentYearMonths(),

  /** Every coach's rollup (sessions, totals, state) for one month. */
  month: (month: string) => api.month(month),
  /** Every month of this year up to now, each with its rollups. */
  yearRollups: async (): Promise<MonthRollups[]> => {
    const months = currentYearMonths().filter((m) => m <= MOCK.CURRENT_MONTH);
    const all = await Promise.all(months.map((m) => api.month(m)));
    return months.map((month, i) => ({ month, rows: all[i].rows }));
  },
  sessions: (coachId: string, month: string) => callFn<{ sessions: Session[] }>(`sessions/${coachId}/${month}`),

  // Month lifecycle: logging → settled → paid
  settle: (coachId: string, month: string) => callFn<void>("settle", { method: "POST", body: { coachId, month } }),
  reopen: (coachId: string, month: string) => callFn<void>("reopen", { method: "POST", body: { coachId, month } }),
  /** Pays all that's left when no amount is given; otherwise a part payment. */
  pay: (coachId: string, month: string, input?: { amount: number; date: string; method: PayMethod; note?: string }) =>
    callFn<{ paidAmount: number; remaining: number }>("pay", { method: "POST", body: { coachId, month, ...input } }),
  payments: (coachId: string, month: string) => callFn<{ payments: SettlementPayment[] }>(`pay/payments?coachId=${coachId}&month=${month}`),

  /** Every private package a coach sold in a month, with client/bundle names attached. */
  packagesByCoach: (coachId: string, month: string) => callFn<{ packages: PackageWithNames[] }>(`packages/by-coach/${coachId}/${month}`),
};

import { useAsync } from "../../../../shared/api/useAsync";
import { useSave } from "../../../../shared/api/useSave";
import type { Profile } from "../../../../shared/types";
import { coachesRepository as repo, type PayMethod } from "../../data/coachesRepository";
import { ledgerRows, paidThisYear, payableYear, payees, rowFor, type CoachMonth } from "../../domain/payroll";

export const CURRENT_MONTH = repo.currentMonth;
export const yearMonths = repo.yearMonths;

/** Add, move or remove one of a coach's sessions (the day sheet). */
export const daySessionCalls = { add: repo.addSession, move: repo.editSession, remove: repo.removeSession };

/** Every payee's rollup for one month (the Team screen). */
export function useTeamMonth(month: string) {
  const { data } = useAsync(() => repo.month(month), [month]);
  return data ? payees(data.rows) : null;
}

/** This year's payees month by month, up to now (the To Pay screen). */
export function usePayableYear() {
  const { data } = useAsync(async () => payableYear(await repo.yearRollups()), []);
  return data ?? null;
}

/** One coach's month: their rollup and sessions. A null coach loads nothing. */
export function useCoachMonth(coachId: string | null, month: string) {
  return useAsync<CoachMonth | null>(async () => {
    if (coachId === null) return null;
    const [monthRes, sessionsRes] = await Promise.all([repo.month(month), repo.sessions(coachId, month)]);
    return { row: rowFor(monthRes.rows, coachId), sessions: sessionsRes.sessions };
  }, [coachId, month]);
}

/** A payee's month for the accountant: rollup, PT packages sold, payments made. */
export function usePayeeMonth(coachId: string, month: string) {
  const { data } = useAsync(async () => {
    const [monthRes, packagesRes, paymentsRes] = await Promise.all([repo.month(month), repo.packagesByCoach(coachId, month), repo.payments(coachId, month)]);
    return { row: rowFor(monthRes.rows, coachId), packages: packagesRes.packages, payments: paymentsRes.payments };
  }, [coachId, month]);
  return data ?? null;
}

export type LedgerData = { kind: "personal"; row: CoachMonth["row"]; sessions: CoachMonth["sessions"] } | { kind: "roster"; rows: ReturnType<typeof ledgerRows>; ytdPaid?: number };

/** History: a coach sees their own month; heads see the roster; the accountant sees what was paid. */
export function useLedger(profile: Profile | null, month: string, view: { personal: boolean; accountant: boolean }) {
  const { data } = useAsync<LedgerData | null>(async () => {
    if (!profile) return null;
    if (view.personal) {
      const [monthRes, sessionsRes] = await Promise.all([repo.month(month), repo.sessions(profile.id, month)]);
      return { kind: "personal", row: rowFor(monthRes.rows, profile.id), sessions: sessionsRes.sessions };
    }
    const monthRes = await repo.month(month);
    const rows = ledgerRows(monthRes.rows, view.accountant);
    if (view.accountant) return { kind: "roster", rows, ytdPaid: paidThisYear(payableYear(await repo.yearRollups())) };
    return { kind: "roster", rows };
  }, [profile?.id, profile?.role, month]);
  return data ?? null;
}

/** Settle or reopen a coach's month. */
export function useMonthActions(coachId: string, month: string) {
  const { busy, error, run } = useSave();
  return {
    busy,
    error,
    settle: () => run(() => repo.settle(coachId, month)),
    reopen: () => run(() => repo.reopen(coachId, month)),
  };
}

/** Record a payment against a settled month. Resolves to what's left, or null if it failed. */
export function usePayment(coachId: string, month: string) {
  const { busy, error, setError, run } = useSave();
  const pay = async (input: { amount: number; date: string; method: PayMethod; note?: string }): Promise<number | null> => {
    let remaining = 0;
    const ok = await run(async () => {
      remaining = (await repo.pay(coachId, month, input)).remaining;
    });
    return ok ? remaining : null;
  };
  return { pay, busy, error, setError };
}

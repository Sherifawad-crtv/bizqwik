import { useState } from "react";
import { useAsync } from "../../../../shared/api/useAsync";
import { accountingRepository } from "../../data/accountingRepository";
import { filterExpenses, totalOf } from "../../domain/accounting";

export const CURRENT_MONTH = accountingRepository.currentMonth;

/** A small local "something changed, re-fetch" counter — the same idea as
 * the app's global `bump()`, but scoped to this screen so an expense edit
 * refreshes the P&L tab without re-fetching every open screen in the app. */
function useLocalBump() {
  const [key, setKey] = useState(0);
  return { key, bump: () => setKey((k) => k + 1) };
}

/** The Accounting screen's shared data: categories and the month's P&L. */
export function useAccounting(month: string) {
  const cats = useAsync(() => accountingRepository.categories(), []);
  const refresh = useLocalBump();
  const pnl = useAsync(() => accountingRepository.pnl(month), [month, refresh.key]);
  return {
    categories: cats.data?.categories ?? [],
    refetchCategories: cats.refetch,
    pnl: pnl.data ?? null,
    /** Call after an expense changes so the P&L reloads. */
    expensesChanged: refresh.bump,
  };
}

/** One month's expenses, filtered by category and note search. */
export function useExpenses(month: string, categoryFilter: string, query: string) {
  const { data, refetch } = useAsync(() => accountingRepository.expenses(month), [month]);
  const expenses = filterExpenses(data?.expenses ?? [], categoryFilter, query);
  return { loaded: !!data, expenses, total: totalOf(expenses), refetch };
}

export function useRecurring() {
  const { data, refetch } = useAsync(() => accountingRepository.recurring(), []);
  return { loaded: !!data, recurring: data?.recurring ?? [], refetch };
}

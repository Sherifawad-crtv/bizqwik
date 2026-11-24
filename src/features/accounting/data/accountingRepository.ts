import { callFn } from "../../../shared/api/core";
import { MOCK } from "../../../shared/api/backend";
import type { Expense, ExpenseCategory, PnlReport, RecurringExpense } from "../domain/types";

// Data layer: every server call the accounting feature makes. Only accounting
// uses these endpoints, so they live here rather than in shared/api.
export const accountingRepository = {
  /** The month the app treats as "now". */
  currentMonth: MOCK.CURRENT_MONTH,

  // Expense categories
  categories: () => callFn<{ categories: ExpenseCategory[] }>("accounting/categories"),
  createCategory: (name: string) => callFn<{ category: ExpenseCategory }>("accounting/categories", { method: "POST", body: { name } }),
  renameCategory: (id: string, name: string) => callFn<{ category: ExpenseCategory }>("accounting/categories/update", { method: "POST", body: { id, name } }),
  setCategoryArchived: (id: string, archived: boolean) => callFn<{ category: ExpenseCategory }>("accounting/categories/update", { method: "POST", body: { id, archived } }),

  // One-off expenses
  expenses: (month: string) => callFn<{ expenses: Expense[] }>(`accounting/expenses?month=${month}`),
  addExpense: (categoryId: string, amount: number, date: string, note?: string, receipt?: string) =>
    callFn<{ expense: Expense }>("accounting/expenses", { method: "POST", body: { categoryId, amount, date, note, receipt } }),
  updateExpense: (id: string, patch: { categoryId?: string; amount?: number; date?: string; note?: string }) =>
    callFn<{ expense: Expense }>("accounting/expenses/update", { method: "POST", body: { id, ...patch } }),
  deleteExpense: (id: string) => callFn<{ ok: true }>("accounting/expenses/delete", { method: "POST", body: { id } }),

  // Recurring expense templates
  recurring: () => callFn<{ recurring: RecurringExpense[] }>("accounting/recurring"),
  createRecurring: (categoryId: string, amount: number, dayOfMonth: number, note?: string, endMonth?: string) =>
    callFn<{ recurring: RecurringExpense }>("accounting/recurring", { method: "POST", body: { categoryId, amount, dayOfMonth, note, endMonth } }),
  updateRecurring: (id: string, patch: { active?: boolean; amount?: number; categoryId?: string; note?: string; dayOfMonth?: number; endMonth?: string | null }) =>
    callFn<{ recurring: RecurringExpense }>("accounting/recurring/update", { method: "POST", body: { id, ...patch } }),
  deleteRecurring: (id: string) => callFn<{ ok: true }>("accounting/recurring/delete", { method: "POST", body: { id } }),

  // Profit & loss
  pnl: (month: string) => callFn<PnlReport>(`accounting/pnl?month=${month}`),
};

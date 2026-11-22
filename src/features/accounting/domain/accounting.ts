import type { Expense, ExpenseCategory, PnlReport, RecurringExpense } from "../../../shared/types";

// Accounting rules: months, categories, expenses, recurring templates and P&L.
// Pure functions: no React, no server calls.

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

// ---- Months ----------------------------------------------------------------

/** The last `n` months up to and including `currentMonth`, oldest first, as yyyy-mm. */
export function monthsBack(n: number, currentMonth: string): string[] {
  const [y, m] = currentMonth.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export const isMonth = (v: string) => /^\d{4}-\d{2}$/.test(v);

// ---- Categories ------------------------------------------------------------

export const activeCategories = (cats: ExpenseCategory[]) => cats.filter((c) => !c.archived);

/** The category a new expense or template starts on: the first one not archived. */
export const defaultCategoryId = (cats: ExpenseCategory[]) => cats.find((c) => !c.archived)?.id ?? "";

// ---- Expenses --------------------------------------------------------------

/** Expenses in a category (or all, for ""), whose note contains the search text. */
export function filterExpenses(expenses: Expense[], categoryId: string, query: string): Expense[] {
  const q = query.trim().toLowerCase();
  return expenses.filter((e) => (!categoryId || e.categoryId === categoryId) && (!q || (e.note ?? "").toLowerCase().includes(q)));
}

export const totalOf = (expenses: Expense[]) => expenses.reduce((a, e) => a + e.amount, 0);

/** A repeating day must fit every month, so it stops at 28. */
export const defaultDayOfMonth = (today: Date) => Math.min(28, today.getDate());

/** Expense form: a positive amount and a category. */
export function checkExpense(amountText: string, categoryId: string): Checked<{ amount: number }> {
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount." };
  if (!categoryId) return { ok: false, error: "Choose a category." };
  return { ok: true, value: { amount } };
}

// ---- Recurring templates ---------------------------------------------------

/** Recurring form: a positive amount, a category and a day between 1 and 28. */
export function checkRecurring(amountText: string, categoryId: string, dayText: string): Checked<{ amount: number; day: number }> {
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount." };
  if (!categoryId) return { ok: false, error: "Choose a category." };
  const day = Number(dayText);
  if (!Number.isInteger(day) || day < 1 || day > 28) return { ok: false, error: "Pick a day between 1 and 28." };
  return { ok: true, value: { amount, day } };
}

/** The next date (yyyy-mm-dd) a template will create an expense, or null if paused or ended. */
export function nextOccurrence(r: RecurringExpense, today: Date = new Date()): string | null {
  if (!r.active) return null;
  const todayIso = today.toISOString().slice(0, 10);
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, r.dayOfMonth);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (month < r.startMonth) continue;
    if (r.endMonth && month > r.endMonth) return null;
    const iso = d.toISOString().slice(0, 10);
    if (iso >= todayIso) return iso;
  }
  return null;
}

/** A blank template for "Add a repeating expense". An empty id means new. */
export function newRecurringTemplate(cats: ExpenseCategory[], currentMonth: string, today: Date = new Date()): RecurringExpense {
  return { id: "", categoryId: defaultCategoryId(cats), categoryName: "", amount: 0, note: null, dayOfMonth: defaultDayOfMonth(today), startMonth: currentMonth, endMonth: null, active: true };
}

// ---- Profit & loss ---------------------------------------------------------

/** Nothing to report: no revenue this month and no expenses ever. */
export const isEmptyReport = (report: PnlReport) => !report.hasPastExpenses && report.current.grossRevenue === 0;

/** The month before the current one in the trend, for the change arrows. */
export const previousMonth = (report: PnlReport) => (report.trend.length >= 2 ? report.trend[report.trend.length - 2] : null);

/** Profit as a % of net revenue; null when there's no revenue to divide by. */
export const profitMargin = (current: PnlReport["current"]) => (current.netRevenue > 0 ? (current.profit / current.netRevenue) * 100 : null);

export const hasNoActivity = (trend: PnlReport["trend"]) => trend.every((m) => m.netRevenue === 0 && m.totalExpenses === 0);

/** Coach payouts not yet paid out. */
export const stillOwed = (amount: number, paid: number) => Math.max(0, amount - paid);

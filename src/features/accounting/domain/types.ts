// Accounting's data types: the shapes its server calls return and its
// screens show. Types several features use stay in shared/types/.

// ---- accounting: expenses & profit and loss ----
export interface ExpenseCategory {
  id: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
  archived: boolean;
}

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  date: string; // yyyy-mm-dd
  note: string | null;
  hasReceipt: boolean;
  receiptUrl: string | null; // short-lived; re-fetch the list to refresh
  recurringId: string | null;
  createdBy: string;
  editedAfterMonthEnd: boolean;
}

export interface RecurringExpense {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  note: string | null;
  dayOfMonth: number;
  startMonth: string;
  endMonth: string | null;
  active: boolean;
}

export interface MoneySlice {
  key: string;
  label: string;
  amount: number;
  /** Coach payouts only: how much of it has actually been paid out. */
  paid?: number;
}

export interface PnlMonth {
  month: string;
  grossRevenue: number;
  refunds: number;
  netRevenue: number;
  coachPayouts: number;
  otherExpenses: number;
  totalExpenses: number;
  profit: number;
}

export interface PnlReport {
  month: string;
  current: PnlMonth;
  trend: PnlMonth[];
  revenueBySource: MoneySlice[];
  expensesBySource: MoneySlice[];
  hasPastExpenses: boolean;
  unsettledNote: { count: number } | null;
}

import type { GroupPlanKind } from "./plans";

// Money: how a sale is paid, and the revenue and payment reports.

// How a desk sale is paid. cash/card are external (recorded only); wallet spends
// the member's store credit. Default cash keeps older callers unchanged.
export type PayMethod = "cash" | "card" | "instapay" | "wallet";
export const PAY_METHOD_LABELS: Record<PayMethod, string> = { cash: "Cash", card: "Card", instapay: "InstaPay", wallet: "Wallet" };

// dept_head money view (GET /revenue).
export interface RevenueSlice {
  key: string;
  label: string;
  amount: number;
}
export interface RevenueReport {
  months: { month: string; revenue: number; payouts: number; profit: number }[];
  /** The month-by-month series for the longer window asked for with `history` (oldest first). */
  history?: { month: string; revenue: number; payouts: number; profit: number }[];
  totals: { revenue: number; payouts: number; profit: number };
  byService: RevenueSlice[];
  byType: RevenueSlice[];
  byCoach: { coachId: string; name: string; revenue: number; payouts: number }[];
  activeSubscribers: { total: number; groupPlans: number; ptPackages: number; byPlanKind: Record<GroupPlanKind, number> };
  walletLiability: number;
}

// ===== Money by payment method (dept_head / accountant) =====
export interface PaymentsSummary {
  months: number;
  total: number;
  byMethod: { method: "instapay" | "cash" | "card" | "other"; label: string; amount: number; count: number }[];
  transfers: { id: string; at: string; clientName: string | null; amount: number; what: string }[];
  // Revenue per month across the range (oldest first).
  byMonth?: { month: string; revenue: number }[];
}

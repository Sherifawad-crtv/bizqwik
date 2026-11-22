import type { ActivityEntry, ClientWithPackage, PaymentsSummary, RevenueReport } from "../../../shared/types";

// Money rules: transactions, payment methods, revenue comparisons.
// Pure functions: no React, no server calls.

// ---- Transactions (solo owner's Money screen) -------------------------------

export interface Txn { id: string; at: string; clientName: string | null; amount: number; what: string; method: string; refund: boolean; entry: ActivityEntry }

const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", instapay: "InstaPay", wallet: "Wallet" };

/** Every sale and refund in the last `months` (this month counts as 1), newest
 * first, each tagged with how it was paid. */
export function toTransactions(list: ActivityEntry[], months: number, now: Date = new Date()): Txn[] {
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).getTime();
  const out: Txn[] = [];
  for (const a of list) {
    if (Date.parse(a.at) < since) continue;
    const m = (a.meta ?? {}) as Record<string, unknown>;
    const amount = Number(a.amount ?? 0);
    if (a.type.startsWith("sale_") || a.type === "class_collected") {
      const name = (m.name ?? m.title) as string | undefined;
      out.push({ id: a.id, at: a.at, clientName: a.clientName ?? (a.type === "sale_dropin" ? "Drop-in guest" : null), amount, what: name ?? (a.type === "sale_package" ? "PT package" : a.type === "class_collected" ? "Class" : a.type === "sale_dropin" ? "Drop-in" : "Sale"), method: METHOD_LABEL[String(m.payMethod ?? "")] ?? "Not recorded", refund: false, entry: a });
    } else if (a.type === "refund_desk") {
      const note = String(m.note ?? "");
      out.push({ id: a.id, at: a.at, clientName: a.clientName, amount, what: "Refund", method: /^instapay/i.test(note) ? "InstaPay" : "Cash", refund: true, entry: a });
    } else if (a.type === "wallet_refund") {
      out.push({ id: a.id, at: a.at, clientName: a.clientName, amount, what: "Refund", method: "Wallet", refund: true, entry: a });
    }
  }
  return out;
}

/** Transactions at one location, or all of them when `locationId` is null. */
export const atLocation = (txns: Txn[], locationId: string | null) =>
  txns.filter((t) => !locationId || (t.entry.meta as Record<string, unknown> | null)?.locationId === locationId);

export const paymentCount = (pay: PaymentsSummary) => pay.byMethod.reduce((a, m) => a + m.count, 0);

/** The client a transaction belongs to — only when exactly one client has that name. */
export function clientOf(txn: Txn, clients: ClientWithPackage[]): ClientWithPackage | null {
  const matches = clients.filter((c) => c.name === txn.clientName);
  return matches.length === 1 ? matches[0] : null;
}

/** The transaction's note without the "InstaPay ·" prefix the desk adds. */
export const txnNote = (txn: Txn) => String(((txn.entry.meta ?? {}) as Record<string, unknown>).note ?? "").replace(/^InstaPay\s*·?\s*/i, "");

/** Short reference shown to match a payment against a bank app. */
export const txnReference = (txn: Txn) => txn.id.slice(0, 8).toUpperCase();

// ---- Activity feed (accountant's Transactions screen) ----------------------

export type MoneyKind = "all" | "sales" | "refunds" | "wallet";

/** Anything that moves money: sales, desk refunds and collections, wallet changes. */
export const isMoney = (type: string) => type.startsWith("sale_") || type.startsWith("wallet_") || type === "refund_desk" || type === "class_collected";

export const kindOf = (type: string): Exclude<MoneyKind, "all"> =>
  type.startsWith("sale_") || type === "class_collected" ? "sales" : type === "refund_desk" || type === "wallet_refund" ? "refunds" : "wallet";

/** Money entries with an amount, in feed order. */
export const moneyEntries = (list: ActivityEntry[]) => list.filter((e) => isMoney(e.type) && e.amount != null);

export const ofKind = (entries: ActivityEntry[], kind: MoneyKind) => (kind === "all" ? entries : entries.filter((e) => kindOf(e.type) === kind));

/** Total of one kind; expired wallet credit isn't counted as a change. */
export const totalOfKind = (entries: ActivityEntry[], kind: Exclude<MoneyKind, "all">) =>
  entries.filter((e) => kindOf(e.type) === kind && e.type !== "wallet_expired").reduce((s, e) => s + Math.abs(e.amount ?? 0), 0);

// ---- Revenue overview --------------------------------------------------------

export interface RevenueView {
  report: RevenueReport;
  /** Totals for the same-length period just before the range. */
  previous: { revenue: number; payouts: number; profit: number };
  /** Month-by-month chart: the business's whole story so far, up to a year. */
  trend: RevenueReport["months"];
  /** How many months have any activity at all. */
  monthsOfData: number;
}

/** Turns a report (fetched with a long history tail) into the overview for a range of `n` months. */
export function revenueView(report: RevenueReport, n: number): RevenueView {
  const rows = report.history ?? report.months;
  const first = rows.findIndex((m) => m.revenue > 0 || m.payouts > 0);
  const before = rows.slice(Math.max(0, rows.length - 2 * n), rows.length - n);
  const sum = (k: "revenue" | "payouts") => before.reduce((a, m) => a + m[k], 0);
  const previous = { revenue: sum("revenue"), payouts: sum("payouts"), profit: sum("revenue") - sum("payouts") };
  const trend = first < 0 ? rows.slice(-1) : rows.slice(Math.max(first, rows.length - 12));
  return { report, previous, trend, monthsOfData: first < 0 ? 0 : rows.length - first };
}

/** What a range of `n` months can honestly show, given how much history exists. */
export function rangeCoverage(view: RevenueView | null, n: number) {
  const depth = view ? Math.max(1, view.monthsOfData) : n;
  return {
    depth,
    /** The months the numbers cover. */
    shown: view ? view.report.months.slice(-Math.min(n, depth)) : [],
    /** The business is younger than the range. */
    short: view ? depth < n : false,
    /** The period before, only when there's enough history to compare with. */
    compare: view && depth > n ? view.previous : null,
  };
}

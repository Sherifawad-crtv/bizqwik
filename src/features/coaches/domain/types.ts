// Coaches' data types: the shapes its server calls return and its
// screens show. Types several features use stay in shared/types/.
import type { PackageInstance } from "../../../shared/types";

export type PayMethodOut = "cash" | "bank" | "instapay" | "other";

/** One payment made against a settled month. */
export interface SettlementPayment {
  id: string;
  amount: number;
  paidOn: string;
  method: PayMethodOut;
  note: string | null;
  paidBy: string | null;
  createdAt: string;
}

// Coach payout drill-down row — a package plus the names needed to show it
// without a second lookup. Deliberately excludes Client.conditions: this is
// a finance view (accountant module), not a client-management one.
export interface PackageWithNames extends PackageInstance {
  clientName: string;
  bundleName: string;
}

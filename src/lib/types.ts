export type Role = "dept_head" | "head_coach" | "coach" | "accountant";
export type State = "logging" | "settled" | "paid";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  tierId: string | null;
}

export interface Tier {
  id: string;
  name: string;
  rate: number;
  privateCutPct: number;
}

export interface Session {
  id: string;
  coachId: string;
  month: string;
  date: string;
  createdBy: string;
}

export interface Invite {
  email: string;
  role: Role;
  tierId: string | null;
  invitedBy: string;
}

export interface Rollup {
  coachId: string;
  name: string;
  email: string;
  role: Role;
  tierId: string | null;
  tierName: string | null;
  rate: number;
  count: number;
  groupTotal: number;
  privateTotal: number;
  packageCount: number;
  total: number;
  state: State;
  settledAt: string | null;
  paidAt: string | null;
}

export interface BundleType {
  id: string;
  name: string;
  price: number;
  sessionsIncluded: number;
  expiryDays: number;
}

export interface Client {
  id: string;
  name: string;
  age: number | null;
  conditions: string | null;
  assignedCoachId: string | null;
}

export type PackageStatus = "active" | "exhausted" | "expired";

export interface PackageInstance {
  id: string;
  clientId: string;
  bundleTypeId: string;
  coachId: string;
  purchaseDate: string;
  expiryDate: string;
  sessionsIncluded: number;
  sessionsRemaining: number;
  priceAtSale: number;
  coachCutAtSale: number;
  status: PackageStatus;
  createdBy: string;
}

export interface ClientWithPackage extends Client {
  currentPackage: PackageInstance | null;
}

// Coach payout drill-down row — a package plus the names needed to show it
// without a second lookup. Deliberately excludes Client.conditions: this is
// a finance view (accountant module), not a client-management one.
export interface PackageWithNames extends PackageInstance {
  clientName: string;
  bundleName: string;
}

export interface DeliveryLog {
  id: string;
  packageInstanceId: string;
  date: string;
  loggedBy: string;
}

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  active: "Active",
  exhausted: "Exhausted",
  expired: "Expired",
};

export const isHead = (r?: Role) => r === "dept_head" || r === "head_coach";
// Who counts as a "coach" — shows up in coach rosters/rollups, gets picked as
// a private-training coach, etc. dept_head is management-only for now (no
// personal group sessions, no My Month, not a private-training coach) —
// revisit if v2 brings that back.
export const canLog = (r?: Role) => r === "coach" || r === "head_coach";

export const ROLE_LABELS: Record<Role, string> = {
  dept_head: "Department Head",
  head_coach: "Head Coach",
  coach: "Coach",
  accountant: "Head Accountant",
};

export const STATE_LABELS: Record<State, string> = {
  logging: "Logging",
  settled: "Settled",
  paid: "Paid",
};

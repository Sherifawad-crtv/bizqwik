export type Role = "dept_head" | "head_coach" | "coach" | "accountant" | "front_desk";
export type State = "logging" | "settled" | "paid";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  tierId: string | null;
  avatarUrl: string | null;
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
  /** "qr" = the coach scanned the coaches' QR; "manual" = a head logged it. */
  source?: "qr" | "manual";
  /** When the session was recorded (the scan time for a QR session). */
  createdAt?: string | null;
}

export interface PtScanPreview {
  id: string;
  clientName: string;
  bundleName: string;
  sessionsRemaining: number;
  sessionsIncluded: number;
  expiryDate: string;
}

export type ScanResult =
  | { kind: "attendance"; date: string; month: string }
  | { kind: "pt"; package: PtScanPreview };

export interface Rollup {
  coachId: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
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
  /** Paid out of a settled month so far (all of it once paid), and what's left to pay. */
  paidAmount: number;
  remaining: number;
}

export interface BundleType {
  id: string;
  name: string;
  price: number;
  sessionsIncluded: number;
  expiryDays: number;
  locationId?: string | null;
  /** False once taken off sale; people who already hold one keep it. */
  active?: boolean;
}

// A place the business runs sessions. Plans, PT bundles and sessions can be
// tied to one; a member has a home location.
export interface Location {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  name: string;
  age: number | null;
  phone?: string | null;
  email?: string | null;
  conditions: string | null;
  assignedCoachId: string | null;
  homeLocationId?: string | null;
}

export type MembershipStatus = "active" | "expired";

export interface MembershipInstance {
  id: string;
  clientId: string;
  membershipTypeId: string;
  startDate: string;
  expiryDate: string;
  status: MembershipStatus;
  invitationsRemaining: number;
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
  locationId?: string | null;
}

export interface ClientWithPackage extends Client {
  currentPackage: PackageInstance | null;
  currentMembership?: MembershipInstance | null;
  // The member's one active group plan (membership / class monthly / bundle), if any.
  groupPlan?: GroupPlan | null;
  // When there's no active plan: the one that ended most recently (last 90 days).
  lastGroupPlan?: GroupPlan | null;
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
// Roles paid per session, so a pay tier means something for them.
export const hasTier = (r?: Role) => r === "coach" || r === "head_coach" || r === "dept_head";

export const ROLE_LABELS: Record<Role, string> = {
  dept_head: "Department Head",
  head_coach: "Head Coach",
  coach: "Coach",
  accountant: "Head Accountant",
  front_desk: "Front Desk",
};

export const STATE_LABELS: Record<State, string> = {
  logging: "Logging",
  settled: "Settled",
  paid: "Paid",
};

// ===== Bizqwik ops (internal, bizqwik_team only) =====
// A Bizqwik-team member runs the platform itself, across every org. They have
// no org profile — these types describe the ops dashboard, not any single gym.
export type BizqwikRole = "founder" | "ops_manager" | "teammate";

export interface BizqwikTeam {
  id: string;
  name: string;
  email: string;
  role: BizqwikRole;
}

export const BIZQWIK_ROLE_LABELS: Record<BizqwikRole, string> = {
  founder: "Founder",
  ops_manager: "Ops Manager",
  teammate: "Teammate",
};

// How a desk sale is paid. cash/card are external (recorded only); wallet spends
// the member's store credit. Default cash keeps older callers unchanged.
export type PayMethod = "cash" | "card" | "instapay" | "wallet";
export const PAY_METHOD_LABELS: Record<PayMethod, string> = { cash: "Cash", card: "Card", instapay: "InstaPay", wallet: "Wallet" };

// ===== Member app: classes (dept_head manages; members book) =====
export type GymClassStatus = "active" | "cancelled";

export interface GymClass {
  id: string;
  seriesId?: string | null;
  title: string;
  description: string | null;
  startsAt: string;
  price: number; // the drop-in price
  status: GymClassStatus;
  // The card photo members see (a series session shows its series' photo).
  imageUrl?: string | null;
  bookedCount?: number;
  // Solo gyms: who said they're coming (names), instead of bookings.
  coming?: string[];
  planSeats?: number;
  dropInSeats?: number;
  locationId?: string | null;
}

export type BookingAttendance = "booked" | "arrived" | "no_show" | "cancelled";
export type BookingPayStatus = "paid" | "pending" | "refunded";

// A class booking as staff see it (roster row): who booked, how they're paying,
// whether they've paid, and their attendance.
export interface ClassBooking {
  id: string;
  classId: string;
  clientName: string | null;
  payMethod: "wallet" | "desk" | "plan";
  payStatus: BookingPayStatus;
  attendance: BookingAttendance;
  price: number;
  // "plan" = paid for by the member's group plan; "drop_in" = paid per class.
  coverage: "plan" | "drop_in";
}

// ===== Staff activity feed / logs (dept_head + front_desk) =====
export interface ActivityEntry {
  id: string;
  type: string; // check_in | class_booked | sale_* | wallet_* | points_earned | …
  amount: number | null;
  clientName: string | null;
  /** The staff member who did it (members' own actions have none). */
  actorName?: string | null;
  meta: Record<string, unknown> | null;
  at: string;
}

// ===== Services model: recurring classes + group plans =====
// A class series repeats on the chosen weekdays at one local time, month to
// month, until someone edits or ends it. Each session is bookable as a
// drop-in; the monthly price buys a month of that one class.
export interface ClassSeries {
  id: string;
  title: string;
  description: string | null;
  weekdays: number[]; // 0 = Sunday … 6 = Saturday
  startTime: string; // "HH:MM", gym-local
  durationMin: number;
  dropInPrice: number;
  monthlyPrice: number;
  status: "active" | "ended";
  imageUrl?: string | null;
  activeMonthlySubscribers?: number;
  locationId?: string | null;
}

// The founder's catalog: an all-access membership, or a class bundle of N
// credits usable on any class. Both run N months from purchase.
export type GroupPlanTypeKind = "membership" | "bundle";
export interface GroupPlanType {
  id: string;
  kind: GroupPlanTypeKind;
  name: string;
  price: number;
  durationMonths: number;
  credits: number | null;
  invitationsAllowance: number;
  active: boolean;
  locationId?: string | null;
  /** Sold to this many clients at once, each getting an even share of the classes and the price. */
  sharedSeats?: number | null;
}

export type GroupPlanKind = "membership" | "class_monthly" | "bundle";
export interface GroupPlan {
  id: string;
  clientId: string;
  kind: GroupPlanKind;
  planTypeId: string | null;
  seriesId: string | null;
  name: string;
  priceAtSale: number;
  payMethod: PayMethod;
  creditsTotal: number | null;
  creditsRemaining: number | null;
  invitationsRemaining: number;
  startsAt: string;
  expiresAt: string;
  status: "active" | "finished";
  locationId?: string | null;
  // A plan can be frozen for a while; it restarts by itself afterwards.
  frozenUntil?: string | null;
  /** Plans sold together as one shared bundle have the same id. */
  shareGroupId?: string | null;
}

export const GROUP_PLAN_KIND_LABELS: Record<GroupPlanKind, string> = {
  membership: "Membership",
  class_monthly: "Class monthly",
  bundle: "Class bundle",
};

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

import type { PayMethod } from "./money";

// What's sold: PT bundles, group plan types and the group plans clients hold.

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

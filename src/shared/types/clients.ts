import type { GroupPlan } from "./plans";

// Clients, what they hold (memberships, PT packages) and the staff activity feed.

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

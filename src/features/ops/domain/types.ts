// Ops's data types: the shapes its server calls return and its
// screens show. Types several features use stay in shared/types/.
import type { Role, Profile, BizqwikRole } from "../../../shared/types";

export type OrgStatus = "trial" | "active" | "paused";

export interface PlanType {
  id: string;
  name: string;
  price: number;
  // null = unlimited
  teamSizeLimit: number | null;
  clientSizeLimit: number | null;
}

export interface OpsSummary {
  totalOrgs: number;
  activeOrgs: number;
  totalGmv: number;
  bizqwikRevenue: number;
}

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  status: OrgStatus;
  mode?: "solo" | "team";
  planId: string | null;
  planName: string | null;
  staffCount: number;
  clientCount: number;
  gmv: number;
}

export interface OrgUsage {
  staffCount: number;
  clientCount: number;
  sessionsLogged: number;
  packagesSold: number;
  membershipsSold: number;
  dropInsSold: number;
  gmv: number;
  lastActivity: string | null;
}

export interface OrgDetail {
  org: {
    id: string;
    name: string;
    slug: string;
    /** Printed in the coaches' room; coaches scan it to log attendance. */
    coachQrToken: string;
    status: OrgStatus;
    mode?: "solo" | "team";
    planId: string | null;
    planName: string | null;
    createdAt: string;
  };
  plan: PlanType | null;
  staff: Profile[];
  pendingInvites: { email: string; role: Role }[];
  usage: OrgUsage;
}

export interface BizqwikTeamInvite {
  email: string;
  name: string | null;
  role: BizqwikRole;
}

// Per-org member-app configuration (set by ops at onboarding).
export interface OrgBrandingConfig {
  appName: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  primaryColor: string | null;
  onboardingAssets: string[];
}

// Loyalty economy. pointsEarnPerEgp null = points off for the org.
export interface OrgPointsSettings {
  pointsEarnPerEgp: number | null;
  pointsRedeemPerEgp: number;
  pointsCheckin: number;
  pointsMinRedeem: number;
  pointsTtlMonths: number;
  walletCreditTtlMonths: number;
}

export interface OrgConfig {
  branding: OrgBrandingConfig | null;
  settings: OrgPointsSettings | null;
}

export const ORG_STATUS_LABELS: Record<OrgStatus, string> = {
  trial: "Trial",
  active: "Active",
  paused: "Paused",
};

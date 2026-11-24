// Frontdesk's data types: the shapes its server calls return and its
// screens show. Types several features use stay in shared/types.ts.

export interface CoachOption {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface FrontDeskActivity {
  id: string;
  kind: "check_in" | "drop_in";
  name: string;
  detail: string;
  at: string;
}

export interface FrontDeskSummary {
  todayCheckIns: number;
  todayDropIns: number;
  activeNow: number;
  recent: FrontDeskActivity[];
}

/** A member's InstaPay receipt waiting for the front desk to approve. */
export interface PaymentRequest { id: string; clientId: string; clientName: string; clientPhone: string | null; name: string; price: number; offerType: "plan_type" | "bundle_type"; createdAt: string; proofUrl: string | null }

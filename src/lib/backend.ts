// Real backend — talks to the "make-server-980e1cbf" Supabase edge function.
// Same auth/api/MOCK shape as the mock layer this replaced, so no screen
// needed to change: swap this one file to point elsewhere and everything
// keeps working (see supabaseClient.ts for which project it targets).
import { FN_SLUG, supabase } from "./supabaseClient";
import { bump } from "./bus";
import type {
  ActivityEntry,
  BizqwikRole,
  ClassBooking,
  BizqwikTeam,
  BizqwikTeamInvite,
  BundleType,
  ClassSeries,
  Client,
  ClientWithPackage,
  CoachOption,
  FrontDeskSummary,
  GroupPlan,
  GroupPlanType,
  GroupPlanTypeKind,
  GymClass,
  Invite,
  OpsSummary,
  OrgBrandingConfig,
  OrgConfig,
  OrgPointsSettings,
  OrgDetail,
  OrgStatus,
  OrgSummary,
  PackageInstance,
  PackageWithNames,
  PayMethod,
  PlanType,
  Profile,
  RevenueReport,
  Role,
  Rollup,
  Session,
  ScanResult,
  PtScanPreview,
  Tier,
} from "./types";

export interface SeriesInput {
  title: string;
  description: string | null;
  weekdays: number[];
  startTime: string;
  durationMin: number;
  dropInPrice: number;
  monthlyPrice: number;
}

export interface PlanTypeInput {
  kind: GroupPlanTypeKind;
  name: string;
  price: number;
  durationMonths: number;
  credits: number | null;
  invitationsAllowance: number;
}

export interface NewClientFields {
  name: string;
  phone: string | null;
  email: string | null;
}

type Method = "GET" | "POST";

/** A failed call, carrying the server's machine-readable `code` (e.g.
 * "active_plan_confirm") and the full error body, so a screen can react to a
 * specific refusal — like asking "charge a drop-in anyway?" — instead of just
 * showing the message. */
export class ApiError extends Error {
  code: string | null;
  data: Record<string, unknown> | null;
  constructor(message: string, code: string | null, data: Record<string, unknown> | null) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

async function callFn<T>(path: string, opts?: { method?: Method; body?: Record<string, unknown> }): Promise<T> {
  const method = opts?.method ?? "GET";
  const { data, error } = await supabase.functions.invoke(`${FN_SLUG}/${path}`, {
    method,
    body: opts?.body,
  });
  if (error) {
    let message = error.message;
    let code: string | null = null;
    let body: Record<string, unknown> | null = null;
    const ctx = (error as { context?: { json?: () => Promise<Record<string, unknown>> } }).context;
    if (ctx?.json) {
      try {
        body = await ctx.json();
        if (typeof body?.error === "string") message = body.error;
        if (typeof body?.code === "string") code = body.code;
      } catch {
        // fall back to the raw error message
      }
    }
    throw new ApiError(message, code, body);
  }
  // POSTs are the app's only mutations — bump so every mounted useAsync
  // screen revalidates, not just whichever one happened to trigger this.
  if (method === "POST") bump();
  return data as T;
}

export const auth = {
  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  },
  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },
};

export const api = {
  // Returns { profile } for an org staff signup, or { bizqwikTeam } for a
  // Bizqwik-team signup — decided by which invite the email matched.
  signup: (name: string, email: string, password: string) =>
    callFn<{ profile?: Profile; bizqwikTeam?: BizqwikTeam }>("signup", { method: "POST", body: { name, email, password } }),

  me: () => callFn<{ profile: Profile | null; tier: Tier | null; bizqwikTeam: BizqwikTeam | null }>("me"),
  updateMe: (name: string) => callFn<{ profile: Profile }>("me/update", { method: "POST", body: { name } }),
  updateAvatar: (avatarUrl: string | null) => callFn<{ profile: Profile }>("me/update", { method: "POST", body: { avatarUrl } }),

  tiers: () => callFn<{ tiers: Tier[] }>("tiers"),
  createTier: (name: string, rate: number, privateCutPct: number) =>
    callFn<{ tier: Tier }>("tiers", { method: "POST", body: { name, rate, privateCutPct } }),
  updateTier: (id: string, name: string, rate: number, privateCutPct: number) =>
    callFn<void>("tiers/update", { method: "POST", body: { id, name, rate, privateCutPct } }),
  deleteTier: (id: string) => callFn<void>("tiers/delete", { method: "POST", body: { id } }),

  bundleTypes: () => callFn<{ bundleTypes: BundleType[] }>("bundle-types"),
  createBundleType: (name: string, price: number, sessionsIncluded: number, expiryDays: number) =>
    callFn<{ bundleType: BundleType }>("bundle-types", { method: "POST", body: { name, price, sessionsIncluded, expiryDays } }),
  updateBundleType: (id: string, name: string, price: number, sessionsIncluded: number, expiryDays: number) =>
    callFn<void>("bundle-types/update", { method: "POST", body: { id, name, price, sessionsIncluded, expiryDays } }),
  deleteBundleType: (id: string) => callFn<void>("bundle-types/delete", { method: "POST", body: { id } }),

  clients: () => callFn<{ clients: ClientWithPackage[] }>("clients"),
  // Creation and coach assignment happen atomically, in one call — a client
  // never exists without an assigned coach (no orphaned/unassigned clients).
  createClient: (name: string, age: number | null, conditions: string | null, bundleTypeId: string, coachId: string) =>
    callFn<{ client: Client; package: PackageInstance }>("clients", { method: "POST", body: { name, age, conditions, bundleTypeId, coachId } }),
  updateClient: (id: string, name: string, age: number | null, conditions: string | null) =>
    callFn<{ client: Client }>("clients/update", { method: "POST", body: { id, name, age, conditions } }),
  deleteClient: (id: string) => callFn<void>("clients/delete", { method: "POST", body: { id } }),
  sellPackage: (clientId: string, bundleTypeId: string, coachId: string, payMethod?: PayMethod) =>
    callFn<{ package: PackageInstance }>("packages", { method: "POST", body: { clientId, bundleTypeId, coachId, payMethod } }),
  // PT sessions are deducted only by scanning the member's per-bundle code.
  deliverSession: (qrToken: string) =>
    callFn<{ package: PackageInstance; preview: PtScanPreview }>("packages/deliver", { method: "POST", body: { qrToken } }),
  // The FAB scanner: what did the coach just scan?
  scan: (token: string) => callFn<ScanResult>("scan", { method: "POST", body: { token } }),
  // Coach payout drill-down (accountant/dept_head/head_coach): every private
  // package a coach sold in a given month, with client/bundle names attached.
  packagesByCoach: (coachId: string, month: string) => callFn<{ packages: PackageWithNames[] }>(`packages/by-coach/${coachId}/${month}`),

  invites: () => callFn<{ invites: Invite[] }>("invites"),
  createInvite: (email: string, role: Role, tierId: string | null) =>
    callFn<void>("invites", { method: "POST", body: { email, role, tierId } }),
  deleteInvite: (email: string) => callFn<void>("invites/delete", { method: "POST", body: { email } }),

  profiles: () => callFn<{ profiles: Profile[] }>("profiles"),
  assignTier: (id: string, tierId: string | null) => callFn<void>("profiles/assign-tier", { method: "POST", body: { id, tierId } }),
  removeProfile: (id: string) => callFn<void>("profiles/remove", { method: "POST", body: { id } }),

  month: (month: string) => callFn<{ rows: Rollup[] }>(`month/${month}`),
  sessions: (coachId: string, month: string) => callFn<{ sessions: Session[] }>(`sessions/${coachId}/${month}`),
  addSession: (coachId: string, month: string, date: string, scanToken?: string) =>
    callFn<{ session: Session }>("sessions/add", { method: "POST", body: { coachId, month, date, scanToken } }),
  editSession: (id: string, coachId: string, month: string, date: string) =>
    callFn<{ session: Session }>("sessions/edit", { method: "POST", body: { id, coachId, month, date } }),
  removeSession: (id: string, coachId: string, month: string) =>
    callFn<void>("sessions/remove", { method: "POST", body: { id, coachId, month } }),

  settle: (coachId: string, month: string) => callFn<void>("settle", { method: "POST", body: { coachId, month } }),
  reopen: (coachId: string, month: string) => callFn<void>("reopen", { method: "POST", body: { coachId, month } }),
  pay: (coachId: string, month: string) => callFn<void>("pay", { method: "POST", body: { coachId, month } }),

  // Front desk. Coach names only — no payout data, unlike month().
  coaches: () => callFn<{ coaches: CoachOption[] }>("coaches"),
  createServiceClient: (fields: NewClientFields, bundleTypeId: string, coachId: string, payMethod?: PayMethod) =>
    callFn<{ client: Client; package: PackageInstance }>("clients", { method: "POST", body: { ...fields, bundleTypeId, coachId, payMethod } }),
  assignCoach: (id: string, coachId: string) => callFn<{ client: Client }>("clients/assign-coach", { method: "POST", body: { id, coachId } }),
  frontDeskSummary: () => callFn<FrontDeskSummary>("front-desk/summary"),
  checkIn: (clientId: string, source: "qr" | "manual") => callFn<void>("check-ins", { method: "POST", body: { clientId, source } }),
  // A walk-in is always recorded against a member: an existing client, or a
  // new one created with the sale (the backend also registers their app invite).
  dropIn: (member: { clientId: string } | { newClient: NewClientFields }, category: string, price: number, payMethod?: PayMethod, confirmActivePlan = false) =>
    callFn<void>("drop-ins", { method: "POST", body: { ...member, category, price, payMethod, confirmActivePlan } }),
  // A seat in one class session at its drop-in price; lands on the roster.
  classDropIn: (clientId: string, classId: string, payMethod: PayMethod, confirmActivePlan = false) =>
    callFn<void>("drop-ins", { method: "POST", body: { clientId, classId, payMethod, confirmActivePlan } }),
  invite: (clientId: string, inviteeName: string, inviteePhone: string, visitDate: string) =>
    callFn<{ invitationsRemaining: number }>("invitations", { method: "POST", body: { clientId, inviteeName, inviteePhone, visitDate } }),

  // ===== Services: recurring classes, group plan catalog, plan sales, revenue =====
  classSeries: () => callFn<{ series: ClassSeries[] }>("class-series"),
  createClassSeries: (s: SeriesInput) => callFn<{ series: ClassSeries }>("class-series", { method: "POST", body: { ...s } }),
  updateClassSeries: (id: string, s: SeriesInput) =>
    callFn<{ series: ClassSeries; keptBookedSessions: number }>("class-series/update", { method: "POST", body: { id, ...s } }),
  endClassSeries: (id: string) => callFn<{ ok: true; keptBookedSessions: number }>("class-series/end", { method: "POST", body: { id } }),

  planTypes: () => callFn<{ planTypes: GroupPlanType[] }>("plan-types"),
  createPlanType: (p: PlanTypeInput) => callFn<{ planType: GroupPlanType }>("plan-types", { method: "POST", body: { ...p } }),
  updatePlanType: (id: string, p: PlanTypeInput & { active?: boolean }) =>
    callFn<{ planType: GroupPlanType }>("plan-types/update", { method: "POST", body: { id, ...p } }),
  deletePlanType: (id: string) => callFn<{ ok: true }>("plan-types/delete", { method: "POST", body: { id } }),

  // Front desk: sell a group plan to an existing member or a brand-new one.
  // `offer` is a catalog plan or a class series (that class's monthly).
  sellGroupPlan: (target: { clientId: string } | NewClientFields, offer: { planTypeId: string } | { seriesId: string }, payMethod: PayMethod) =>
    callFn<{ client: ClientWithPackage; plan: GroupPlan }>("group-plans/sell", { method: "POST", body: { ...target, ...offer, payMethod } }),
  clientPlans: (clientId: string) => callFn<{ activePlan: GroupPlan | null; plans: GroupPlan[] }>(`group-plans/client/${clientId}`),

  revenue: (months = 6) => callFn<RevenueReport>(`revenue?months=${months}`),

  // ===== Classes (staff read; dept_head writes) =====
  classes: () => callFn<{ classes: GymClass[] }>("classes"),
  createClass: (title: string, description: string | null, startsAt: string, price: number) =>
    callFn<{ class: GymClass }>("classes", { method: "POST", body: { title, description, startsAt, price } }),
  updateClass: (id: string, title: string, description: string | null, startsAt: string, price: number) =>
    callFn<{ class: GymClass }>("classes/update", { method: "POST", body: { id, title, description, startsAt, price } }),
  cancelClass: (id: string) => callFn<{ ok: true }>("classes/cancel", { method: "POST", body: { id } }),

  // ===== Class roster / attendance / at-desk collection (dept_head + front_desk) =====
  classBookings: (classId: string) => callFn<{ bookings: ClassBooking[] }>(`classes/${classId}/bookings`),
  markAttendance: (bookingId: string, attendance: "arrived" | "no_show" | "booked") =>
    callFn<{ ok: true }>("bookings/attendance", { method: "POST", body: { bookingId, attendance } }),
  collectBooking: (bookingId: string, payMethod: PayMethod) =>
    callFn<{ ok: true }>("bookings/collect", { method: "POST", body: { bookingId, payMethod } }),

  // ===== Staff activity feed / logs (dept_head + front_desk) =====
  activity: (limit = 100) => callFn<{ activity: ActivityEntry[] }>(`activity?limit=${limit}`),

  // Invite an existing client to the branded member app (front_desk / dept_head).
  inviteClient: (clientId: string, email: string) =>
    callFn<{ ok: true }>("client-invites", { method: "POST", body: { clientId, email } }),

  // Money flow (front_desk + dept_head). Refund to wallet (store credit) or "desk"
  // (external money, recorded only); compensation is a dept_head goodwill credit.
  refundClient: (clientId: string, amount: number, destination: "wallet" | "desk", note?: string) =>
    callFn<{ ok: true; walletBalance?: number }>("clients/refund", { method: "POST", body: { clientId, amount, destination, note: note ?? null } }),
  compensateClient: (clientId: string, amount: number, note?: string) =>
    callFn<{ ok: true; walletBalance?: number }>("clients/compensate", { method: "POST", body: { clientId, amount, note: note ?? null } }),

  pushVapidPublicKey: () => callFn<{ publicKey: string }>("push/vapid-public-key"),
  pushSubscribe: (sub: PushSubscriptionJSON, deviceId: string) =>
    callFn<void>("push/subscribe", { method: "POST", body: { ...sub, deviceId } as Record<string, unknown> }),
  pushUnsubscribe: (endpoint: string, deviceId: string) => callFn<void>("push/unsubscribe", { method: "POST", body: { endpoint, deviceId } }),

  // ===== Bizqwik ops dashboard (bizqwik_team only) =====
  ops: {
    summary: () => callFn<OpsSummary>("ops/summary"),
    orgs: () => callFn<{ orgs: OrgSummary[] }>("ops/orgs"),
    createOrg: (name: string, slug: string, deptHeadName: string, deptHeadEmail: string, planId: string | null) =>
      callFn<{ org: OrgSummary; deptHeadEmail: string; domain?: { name: string; connected: boolean; reason: string | null } }>("ops/orgs", {
        method: "POST",
        body: { name, slug, deptHeadName, deptHeadEmail, planId },
      }),
    org: (id: string) => callFn<OrgDetail>(`ops/orgs/${id}`),
    setOrgStatus: (id: string, status: OrgStatus) =>
      callFn<{ ok: true; status: OrgStatus }>(`ops/orgs/${id}/status`, { method: "POST", body: { status } }),
    setOrgPlan: (id: string, planId: string | null) =>
      callFn<{ ok: true; planId: string | null }>(`ops/orgs/${id}/plan`, { method: "POST", body: { planId } }),
    // Permanent: removes the org and everything under it. `confirmSlug` must match.
    deleteOrg: (id: string, confirmSlug: string) =>
      callFn<{ ok: true; name: string; loginsRemoved: number }>(`ops/orgs/${id}/delete`, { method: "POST", body: { confirmSlug } }),
    orgConfig: (id: string) => callFn<OrgConfig>(`ops/orgs/${id}/config`),
    setOrgBranding: (id: string, b: OrgBrandingConfig) =>
      callFn<{ ok: true }>(`ops/orgs/${id}/branding`, { method: "POST", body: { ...b } }),
    setOrgSettings: (id: string, settings: OrgPointsSettings) =>
      callFn<{ ok: true }>(`ops/orgs/${id}/settings`, { method: "POST", body: { ...settings } }),

    team: () => callFn<{ members: BizqwikTeam[]; invites: BizqwikTeamInvite[] }>("ops/team"),
    inviteTeam: (name: string, email: string, role: BizqwikRole) =>
      callFn<{ ok: true }>("ops/team/invite", { method: "POST", body: { name, email, role } }),
    cancelTeamInvite: (email: string) => callFn<{ ok: true }>("ops/team/cancel-invite", { method: "POST", body: { email } }),

    plans: () => callFn<{ plans: PlanType[] }>("ops/plans"),
    createPlan: (name: string, price: number, teamSizeLimit: number | null, clientSizeLimit: number | null) =>
      callFn<{ plan: PlanType }>("ops/plans", { method: "POST", body: { name, price, teamSizeLimit, clientSizeLimit } }),
    updatePlan: (id: string, name: string, price: number, teamSizeLimit: number | null, clientSizeLimit: number | null) =>
      callFn<{ plan: PlanType }>("ops/plans/update", { method: "POST", body: { id, name, price, teamSizeLimit, clientSizeLimit } }),
    deletePlan: (id: string) => callFn<{ ok: true }>("ops/plans/delete", { method: "POST", body: { id } }),
  },
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const now = new Date();
const CURRENT_MONTH = monthKey(now);
// current month + the two before it, for the month switcher/segmented control
const MONTHS = [2, 1, 0].map((offset) => monthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1)));

export const MOCK = { CURRENT_MONTH, MONTHS };

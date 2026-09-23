// Real backend — talks to the "make-server-980e1cbf" Supabase edge function.
// Same auth/api/MOCK shape as the mock layer this replaced, so no screen
// needed to change: swap this one file to point elsewhere and everything
// keeps working (see supabaseClient.ts for which project it targets).
import { FN_SLUG, supabase } from "./supabaseClient";
import { bump } from "./bus";
import type {
  BizqwikRole,
  BizqwikTeam,
  BizqwikTeamInvite,
  BundleType,
  Client,
  ClientWithPackage,
  CoachOption,
  FrontDeskSummary,
  Invite,
  MembershipInstance,
  MembershipType,
  OpsSummary,
  OrgDetail,
  OrgStatus,
  OrgSummary,
  PackageInstance,
  PackageWithNames,
  PlanType,
  Profile,
  Role,
  Rollup,
  Session,
  Tier,
} from "./types";

export interface NewClientFields {
  name: string;
  phone: string | null;
  email: string | null;
}

type Method = "GET" | "POST";

async function callFn<T>(path: string, opts?: { method?: Method; body?: Record<string, unknown> }): Promise<T> {
  const method = opts?.method ?? "GET";
  const { data, error } = await supabase.functions.invoke(`${FN_SLUG}/${path}`, {
    method,
    body: opts?.body,
  });
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
    if (ctx?.json) {
      try {
        const body = await ctx.json();
        if (body?.error) message = body.error;
      } catch {
        // fall back to the raw error message
      }
    }
    throw new Error(message);
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
  sellPackage: (clientId: string, bundleTypeId: string, coachId: string) =>
    callFn<{ package: PackageInstance }>("packages", { method: "POST", body: { clientId, bundleTypeId, coachId } }),
  deliverSession: (packageInstanceId: string) =>
    callFn<{ package: PackageInstance }>("packages/deliver", { method: "POST", body: { packageInstanceId } }),
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
  addSession: (coachId: string, month: string, date: string) =>
    callFn<{ session: Session }>("sessions/add", { method: "POST", body: { coachId, month, date } }),
  editSession: (id: string, coachId: string, month: string, date: string) =>
    callFn<{ session: Session }>("sessions/edit", { method: "POST", body: { id, coachId, month, date } }),
  removeSession: (id: string, coachId: string, month: string) =>
    callFn<void>("sessions/remove", { method: "POST", body: { id, coachId, month } }),

  settle: (coachId: string, month: string) => callFn<void>("settle", { method: "POST", body: { coachId, month } }),
  reopen: (coachId: string, month: string) => callFn<void>("reopen", { method: "POST", body: { coachId, month } }),
  pay: (coachId: string, month: string) => callFn<void>("pay", { method: "POST", body: { coachId, month } }),

  membershipTypes: () => callFn<{ membershipTypes: MembershipType[] }>("membership-types"),
  createMembershipType: (name: string, durationDays: number, price: number, invitationsAllowance: number) =>
    callFn<{ membershipType: MembershipType }>("membership-types", { method: "POST", body: { name, durationDays, price, invitationsAllowance } }),
  updateMembershipType: (id: string, name: string, durationDays: number, price: number, invitationsAllowance: number) =>
    callFn<void>("membership-types/update", { method: "POST", body: { id, name, durationDays, price, invitationsAllowance } }),
  deleteMembershipType: (id: string) => callFn<void>("membership-types/delete", { method: "POST", body: { id } }),

  // Front desk. Coach names only — no payout data, unlike month().
  coaches: () => callFn<{ coaches: CoachOption[] }>("coaches"),
  createServiceClient: (fields: NewClientFields, bundleTypeId: string, coachId: string) =>
    callFn<{ client: Client; package: PackageInstance }>("clients", { method: "POST", body: { ...fields, bundleTypeId, coachId } }),
  sellMembership: (target: { clientId: string } | NewClientFields, membershipTypeId: string) =>
    callFn<{ client: ClientWithPackage; membership: MembershipInstance }>("memberships/sell", { method: "POST", body: { ...target, membershipTypeId } }),
  assignCoach: (id: string, coachId: string) => callFn<{ client: Client }>("clients/assign-coach", { method: "POST", body: { id, coachId } }),
  frontDeskSummary: () => callFn<FrontDeskSummary>("front-desk/summary"),
  checkIn: (clientId: string, source: "qr" | "manual") => callFn<void>("check-ins", { method: "POST", body: { clientId, source } }),
  dropIn: (clientId: string | null, category: string, price: number) =>
    callFn<void>("drop-ins", { method: "POST", body: { clientId, category, price } }),
  invite: (clientId: string, inviteeName: string, inviteePhone: string, visitDate: string) =>
    callFn<{ invitationsRemaining: number }>("invitations", { method: "POST", body: { clientId, inviteeName, inviteePhone, visitDate } }),

  pushVapidPublicKey: () => callFn<{ publicKey: string }>("push/vapid-public-key"),
  pushSubscribe: (sub: PushSubscriptionJSON, deviceId: string) =>
    callFn<void>("push/subscribe", { method: "POST", body: { ...sub, deviceId } as Record<string, unknown> }),
  pushUnsubscribe: (endpoint: string, deviceId: string) => callFn<void>("push/unsubscribe", { method: "POST", body: { endpoint, deviceId } }),

  // ===== Bizqwik ops dashboard (bizqwik_team only) =====
  ops: {
    summary: () => callFn<OpsSummary>("ops/summary"),
    orgs: () => callFn<{ orgs: OrgSummary[] }>("ops/orgs"),
    createOrg: (name: string, slug: string, deptHeadName: string, deptHeadEmail: string, planId: string | null) =>
      callFn<{ org: OrgSummary; deptHeadEmail: string }>("ops/orgs", {
        method: "POST",
        body: { name, slug, deptHeadName, deptHeadEmail, planId },
      }),
    org: (id: string) => callFn<OrgDetail>(`ops/orgs/${id}`),
    setOrgStatus: (id: string, status: OrgStatus) =>
      callFn<{ ok: true; status: OrgStatus }>(`ops/orgs/${id}/status`, { method: "POST", body: { status } }),
    setOrgPlan: (id: string, planId: string | null) =>
      callFn<{ ok: true; planId: string | null }>(`ops/orgs/${id}/plan`, { method: "POST", body: { planId } }),

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

// Real backend — talks to the "make-server-980e1cbf" Supabase edge function.
// Same auth/api/MOCK shape as the mock layer this replaced, so no screen
// needed to change: swap this one file to point elsewhere and everything
// keeps working (see supabaseClient.ts for which project it targets).
import { FN_SLUG, supabase } from "./supabaseClient";
import { bump } from "./bus";
import type { BundleType, Client, ClientWithPackage, Invite, PackageInstance, PackageWithNames, Profile, Role, Rollup, Session, Tier } from "./types";

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
};

export const api = {
  me: () => callFn<{ profile: Profile; tier: Tier | null }>("me"),

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
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const now = new Date();
const CURRENT_MONTH = monthKey(now);
// current month + the two before it, for the month switcher/segmented control
const MONTHS = [2, 1, 0].map((offset) => monthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1)));

export const MOCK = { CURRENT_MONTH, MONTHS };

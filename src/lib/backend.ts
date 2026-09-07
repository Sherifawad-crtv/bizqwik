// Real backend — talks to the "make-server-980e1cbf" Supabase edge function.
// Same auth/api/MOCK shape as the mock layer this replaced, so no screen
// needed to change: swap this one file to point elsewhere and everything
// keeps working (see supabaseClient.ts for which project it targets).
import { FN_SLUG, supabase } from "./supabaseClient";
import type { Invite, Profile, Role, Rollup, Session, Tier } from "./types";

type Method = "GET" | "POST";

async function callFn<T>(path: string, opts?: { method?: Method; body?: Record<string, unknown> }): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`${FN_SLUG}/${path}`, {
    method: opts?.method ?? "GET",
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
  createTier: (name: string, rate: number) => callFn<{ tier: Tier }>("tiers", { method: "POST", body: { name, rate } }),
  updateTier: (id: string, name: string, rate: number) => callFn<void>("tiers/update", { method: "POST", body: { id, name, rate } }),
  deleteTier: (id: string) => callFn<void>("tiers/delete", { method: "POST", body: { id } }),

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

import type { PaymentsSummary, BizqwikTeam, BundleType, Profile, Tier } from "../types";
import { callFn } from "./core";

export const accountApi = {
  // Returns { profile } for an org staff signup, or { bizqwikTeam } for a
  // Bizqwik-team signup — decided by which invite the email matched.
  signup: (name: string, email: string, password: string) =>
    callFn<{ profile?: Profile; bizqwikTeam?: BizqwikTeam }>("signup", { method: "POST", body: { name, email, password } }),

  me: () => callFn<{ profile: Profile | null; orgMode?: "solo" | "team" | null; org?: { id: string; name: string; slug: string } | null; tier: Tier | null; bizqwikTeam: BizqwikTeam | null }>("me"),
  // With `locationId`, only that location's sales.
  paymentsSummary: async (months: number, locationId?: string | null): Promise<PaymentsSummary> => {
    const r = await callFn<Partial<PaymentsSummary>>(`payments/summary?months=${months}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}`);
    return { months: r.months ?? months, total: r.total ?? 0, byMethod: r.byMethod ?? [], transfers: r.transfers ?? [], byMonth: r.byMonth ?? [] };
  },
  updateMe: (name: string) => callFn<{ profile: Profile }>("me/update", { method: "POST", body: { name } }),
  updateAvatar: (avatarUrl: string | null) => callFn<{ profile: Profile }>("me/update", { method: "POST", body: { avatarUrl } }),

  tiers: () => callFn<{ tiers: Tier[] }>("tiers"),
  createTier: (name: string, rate: number, privateCutPct: number) =>
    callFn<{ tier: Tier }>("tiers", { method: "POST", body: { name, rate, privateCutPct } }),
  updateTier: (id: string, name: string, rate: number, privateCutPct: number) =>
    callFn<void>("tiers/update", { method: "POST", body: { id, name, rate, privateCutPct } }),
  deleteTier: (id: string) => callFn<void>("tiers/delete", { method: "POST", body: { id } }),

  bundleTypes: () => callFn<{ bundleTypes: BundleType[] }>("bundle-types"),
  createBundleType: (name: string, price: number, sessionsIncluded: number, expiryDays: number, locationId?: string | null) =>
    callFn<{ bundleType: BundleType }>("bundle-types", { method: "POST", body: { name, price, sessionsIncluded, expiryDays, locationId } }),
  updateBundleType: (id: string, name: string, price: number, sessionsIncluded: number, expiryDays: number, locationId?: string | null, active?: boolean) =>
    callFn<void>("bundle-types/update", { method: "POST", body: { id, name, price, sessionsIncluded, expiryDays, locationId, active } }),
};

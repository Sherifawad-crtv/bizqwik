import type { PaymentsSummary, BizqwikTeam, BundleType, Profile, Tier } from "../types";
import { callFn } from "./core";

export const accountApi = {
  me: () => callFn<{ profile: Profile | null; orgMode?: "solo" | "team" | null; org?: { id: string; name: string; slug: string } | null; tier: Tier | null; bizqwikTeam: BizqwikTeam | null }>("me"),
  // With `locationId`, only that location's sales.
  paymentsSummary: async (months: number, locationId?: string | null): Promise<PaymentsSummary> => {
    const r = await callFn<Partial<PaymentsSummary>>(`payments/summary?months=${months}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}`);
    return { months: r.months ?? months, total: r.total ?? 0, byMethod: r.byMethod ?? [], transfers: r.transfers ?? [], byMonth: r.byMonth ?? [] };
  },

  tiers: () => callFn<{ tiers: Tier[] }>("tiers"),

  bundleTypes: () => callFn<{ bundleTypes: BundleType[] }>("bundle-types"),
};

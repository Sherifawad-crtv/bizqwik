import { api } from "../../../shared/api/backend";
import { callFn } from "../../../shared/api/core";
import type { Profile, Tier } from "../../../shared/types";
import type { Invite } from "../domain/types";

// Data layer: every server call the manage feature makes. Only `tiers` is
// shared with other code (the invite flow), so it's wrapped; the rest are
// manage-only and live here.
export const manageRepository = {
  // Pay tiers
  tiers: () => api.tiers(),
  createTier: (name: string, rate: number, privateCutPct: number) =>
    callFn<{ tier: Tier }>("tiers", { method: "POST", body: { name, rate, privateCutPct } }),
  updateTier: (id: string, name: string, rate: number, privateCutPct: number) =>
    callFn<void>("tiers/update", { method: "POST", body: { id, name, rate, privateCutPct } }),
  deleteTier: (id: string) => callFn<void>("tiers/delete", { method: "POST", body: { id } }),

  // Pending invites
  invites: () => callFn<{ invites: Invite[] }>("invites"),
  deleteInvite: (email: string) => callFn<void>("invites/delete", { method: "POST", body: { email } }),

  // People who joined
  profiles: () => callFn<{ profiles: Profile[] }>("profiles"),
  assignTier: (id: string, tierId: string | null) => callFn<void>("profiles/assign-tier", { method: "POST", body: { id, tierId } }),
  removeProfile: (id: string) => callFn<void>("profiles/remove", { method: "POST", body: { id } }),
};

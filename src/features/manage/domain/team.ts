import type { Profile, Tier } from "../../../shared/types";
import type { Invite } from "./types";

// Team rules: pay tiers, who is on them, and the manage screen's tabs.
// Pure functions: no React, no server calls.

export type ManageTab = "tiers" | "invites" | "people";

/** The tab a deep link (?tab=…) asks for; anything else opens Tiers. */
export const tabFromQuery = (search: string): ManageTab => {
  const t = new URLSearchParams(search).get("tab");
  return t === "invites" || t === "people" ? t : "tiers";
};

export const tierName = (tiers: Tier[], tierId: string | null | undefined) => tiers.find((t) => t.id === tierId)?.name ?? "";

export const peopleOnTier = (people: Profile[], tierId?: string) => people.filter((p) => !!tierId && p.tierId === tierId);
export const invitesToTier = (invites: Invite[], tierId?: string) => invites.filter((i) => !!tierId && i.tierId === tierId);

/** A tier can only be deleted once nobody is on it or invited to it. */
export const tierInUse = (people: Profile[], invites: Invite[], tierId?: string) =>
  peopleOnTier(people, tierId).length > 0 || invitesToTier(invites, tierId).length > 0;

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Tier form: a name, a rate above 0, and a private-training cut of 0–100% (blank = 0). */
export function checkTier(name: string, rateText: string, cutText: string): Checked<{ name: string; rate: number; privateCutPct: number }> {
  const rate = Number(rateText);
  const cut = cutText === "" ? 0 : Number(cutText);
  if (!name.trim() || !Number.isFinite(rate) || rate <= 0) return { ok: false, error: "Enter a name and a rate greater than 0." };
  if (!Number.isFinite(cut) || cut < 0 || cut > 100) return { ok: false, error: "Private cut % must be between 0 and 100." };
  return { ok: true, value: { name: name.trim(), rate, privateCutPct: cut } };
}

import type { OrgBrandingConfig, OrgDetail, OrgPointsSettings } from "../../../shared/types";

// Ops rules: org slugs, SaaS plan limits, the member-app config and the
// check-in QR. Pure functions: no React, no server calls.

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** "Iron Athletics!" → "iron-athletics". */
export const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export const limitLabel = (n: number | null) => (n === null ? "Unlimited" : String(n));

// ---- Organizations ---------------------------------------------------------

export function checkNewOrg(name: string, slug: string, headEmail: string): Checked<null> {
  if (!name.trim()) return { ok: false, error: "Organization name is required." };
  if (!slug) return { ok: false, error: "A URL slug is required." };
  if (!headEmail.trim()) return { ok: false, error: "A department-head email is required." };
  return { ok: true, value: null };
}

/** Deleting an org needs its slug typed back exactly. */
export const slugConfirmed = (typed: string, slug: string) => typed.trim().toLowerCase() === slug;

/** Members' check-in code is the org slug; the coaches' room code is a separate
 * secret token so members can't log staff attendance (or vice versa). */
export const qrToken = (org: OrgDetail["org"] | null, forCoaches: boolean) => (forCoaches ? org?.coachQrToken : org?.slug) ?? "";

// ---- SaaS plans ------------------------------------------------------------

/** Plan form: a name, a price of 0 or more, and limits that are whole numbers ≥ 1 or blank (unlimited). */
export function checkSaasPlan(name: string, price: string, team: string, client: string): Checked<{ name: string; price: number; teamLimit: number | null; clientLimit: number | null }> {
  const priceNum = Number(price);
  if (!name.trim()) return { ok: false, error: "Name is required." };
  if (!Number.isFinite(priceNum) || priceNum < 0) return { ok: false, error: "Price must be zero or more." };
  const teamLimit = team.trim() === "" ? null : Number(team);
  const clientLimit = client.trim() === "" ? null : Number(client);
  if (teamLimit !== null && (!Number.isInteger(teamLimit) || teamLimit < 1)) return { ok: false, error: "Team limit must be a whole number of 1 or more, or blank for unlimited." };
  if (clientLimit !== null && (!Number.isInteger(clientLimit) || clientLimit < 1)) return { ok: false, error: "Client limit must be a whole number of 1 or more, or blank for unlimited." };
  return { ok: true, value: { name: name.trim(), price: priceNum, teamLimit, clientLimit } };
}

// ---- Member-app config -----------------------------------------------------

/** Blank earn rate = points off. Defaults: 10 pts/EGP earned, 500 pts = 1 EGP
 * (2% back), 50 pts per check-in, 10,000 pts minimum, 12-month expiry. */
export const POINTS_DEFAULTS = { earn: "10", redeem: "500", checkin: "50", min: "10000", ttl: "12" };

export interface AppConfigForm {
  appName: string;
  logoUrl: string;
  iconUrl: string;
  primaryColor: string;
  assets: string[];
  earn: string;
  redeem: string;
  checkin: string;
  minRedeem: string;
  pointsTtl: string;
  ttlMonths: string;
}

/** Member-app config form → the branding and points settings to save. */
export function checkAppConfig(f: AppConfigForm): Checked<{ branding: OrgBrandingConfig; settings: OrgPointsSettings }> {
  const months = Number(f.ttlMonths);
  if (!Number.isInteger(months) || months < 1) return { ok: false, error: "Wallet credit expiry must be at least 1 month." };
  const whole = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 0 && v.trim() !== "";
  if (f.earn.trim() !== "" && (!whole(f.earn) || Number(f.earn) < 1)) return { ok: false, error: "Points earned per EGP must be a whole number of 1 or more — or blank to turn points off." };
  if (!whole(f.redeem) || Number(f.redeem) < 1 || !whole(f.checkin) || !whole(f.minRedeem) || !whole(f.pointsTtl) || Number(f.pointsTtl) < 1) {
    return { ok: false, error: "Points settings must be whole numbers (redeem rate and expiry at least 1)." };
  }
  // Keep each image on its own slide: an empty slot stays "" (the member app
  // shows the default photo there); only trailing empties are dropped.
  const onboardingAssets = f.assets.map((a) => a.trim());
  while (onboardingAssets.length && !onboardingAssets[onboardingAssets.length - 1]) onboardingAssets.pop();
  return {
    ok: true,
    value: {
      branding: { appName: f.appName.trim() || null, logoUrl: f.logoUrl.trim() || null, iconUrl: f.iconUrl.trim() || null, primaryColor: f.primaryColor.trim() || null, onboardingAssets },
      settings: {
        pointsEarnPerEgp: f.earn.trim() === "" ? null : Number(f.earn),
        pointsRedeemPerEgp: Number(f.redeem),
        pointsCheckin: Number(f.checkin),
        pointsMinRedeem: Number(f.minRedeem),
        pointsTtlMonths: Number(f.pointsTtl),
        walletCreditTtlMonths: months,
      },
    },
  };
}

const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** What the points settings mean for a member, in one line. */
export function pointsPreview(earn: number, redeem: number, checkin: number, min: number): string {
  if (!earn) return "Points are off for this gym.";
  if (!redeem) return "";
  const back = (earn / redeem) * 100;
  return `≈ ${fmtNum(back)}% back on cash/card spend · a check-in is worth ${fmtNum(checkin / redeem)} EGP · members can redeem from ${fmtNum(min / redeem)} EGP (${fmtNum(min)} pts).`;
}

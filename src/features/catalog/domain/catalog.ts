import { atLocation } from "../../../shared/locationRules";
import type { BundleType, ClassSeries, GroupPlanType, GroupPlanTypeKind, Location } from "../../../shared/types";

// Catalog rules: what's on sale where, and checking the plan, bundle,
// drop-in and location forms. Pure functions: no React, no server calls.

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** With 2+ locations, the location the catalog is showing; otherwise null (all). */
export const catalogLocation = (locations: Location[], current: Location | null | undefined): string | null =>
  locations.length > 1 ? (current?.id ?? null) : null;

// ---- Lists -----------------------------------------------------------------

/** Plans of one kind on sale here. Plans taken off sale are gone from the list; people who hold one keep it. */
export const plansOnSale = (plans: GroupPlanType[], kind: GroupPlanTypeKind, here: string | null) =>
  plans.filter((p) => p.kind === kind && p.active && atLocation(p.locationId, here));

/** PT bundles on sale here. */
export const bundlesOnSale = (bundles: BundleType[], here: string | null) =>
  bundles.filter((b) => atLocation(b.locationId, here)).filter((b) => b.active !== false);

export const activeClasses = (series: ClassSeries[], here: string | null) => series.filter((s) => s.status === "active" && atLocation(s.locationId, here));
export const endedClasses = (series: ClassSeries[]) => series.filter((s) => s.status === "ended");

// ---- Group plans -----------------------------------------------------------

export interface PlanForm {
  kind: GroupPlanTypeKind;
  name: string;
  price: string;
  months: string;
  credits: string;
  invitations: string;
  shared: string;
  locationId: string | null;
}

/** Plan form → what to save. `hasLocations` means a location must be chosen. */
export function checkPlan(f: PlanForm, hasLocations: boolean) {
  const isBundle = f.kind === "bundle";
  const priceNum = Number(f.price);
  const creditsNum = Number(f.credits);
  const invitesNum = f.invitations === "" ? 0 : Number(f.invitations);
  const fail = (error: string) => ({ ok: false as const, error });
  if (!f.name.trim()) return fail("Give it a name.");
  if (f.price === "" || !Number.isFinite(priceNum) || priceNum < 0) return fail("Enter a price.");
  if (isBundle && (!Number.isInteger(creditsNum) || creditsNum < 1)) return fail("Enter how many classes the bundle includes.");
  if (!Number.isInteger(invitesNum) || invitesNum < 0) return fail("Guest passes must be a whole number, 0 or more.");
  if (hasLocations && !f.locationId) return fail("Choose the location it's for.");
  const seats = isBundle ? Number(f.shared) : 1;
  if (seats > 1 && creditsNum % seats !== 0) return fail(`${creditsNum} classes can't be split evenly between ${seats} people.`);
  return {
    ok: true as const,
    value: {
      kind: f.kind,
      name: f.name.trim(),
      price: priceNum,
      durationMonths: Number(f.months),
      credits: isBundle ? creditsNum : null,
      invitationsAllowance: invitesNum,
      sharedSeats: seats > 1 ? seats : null,
      ...(hasLocations ? { locationId: f.locationId } : {}),
    },
  };
}

/** A shared bundle splits its classes and price evenly between the people sharing it. */
export function sharedSplit(credits: string, price: string, shared: string): { classes: number; price: number } | null {
  const c = Number(credits), n = Number(shared);
  return c > 0 && c % n === 0 ? { classes: c / n, price: Number(price) / n } : null;
}

// ---- PT bundles ------------------------------------------------------------

/** A PT bundle with no stated validity has no expiry: stored as ten years. */
export const NO_EXPIRY_DAYS = 3650;

/** The expiry field as shown: blank when the bundle never expires. */
export const expiryText = (b: BundleType | null) => (b && b.expiryDays < NO_EXPIRY_DAYS ? String(b.expiryDays) : "");

/** PT bundle form. A solo owner may leave the expiry blank for "no expiry". */
export function checkBundle(name: string, price: string, sessions: string, expiryDays: string, solo: boolean, hasLocations: boolean, locationId: string | null): Checked<{ name: string; price: number; sessions: number; expiryDays: number; locationId: string | null | undefined }> {
  const priceNum = Number(price);
  const sessionsNum = Number(sessions);
  const noExpiry = solo && expiryDays.trim() === "";
  const expiryNum = noExpiry ? NO_EXPIRY_DAYS : Number(expiryDays);
  if (!name.trim() || !Number.isFinite(priceNum) || priceNum <= 0 || !Number.isInteger(sessionsNum) || sessionsNum <= 0 || !Number.isInteger(expiryNum) || expiryNum <= 0) {
    return { ok: false, error: solo ? "Enter a name, a price and whole-number sessions (and whole-number days if it expires)." : "Enter a name, a price, whole-number sessions, and whole-number expiry days — all greater than 0." };
  }
  if (hasLocations && !locationId) return { ok: false, error: "Choose the location it's for." };
  return { ok: true, value: { name: name.trim(), price: priceNum, sessions: sessionsNum, expiryDays: expiryNum, locationId: hasLocations ? locationId : undefined } };
}

// ---- Solo drop-ins and locations -------------------------------------------

export interface DropInRow { label: string; price: string }

/** Every drop-in in the list needs a name and a price of 0 or more. */
export function checkDropIns(rows: DropInRow[]): Checked<{ label: string; price: number }[]> {
  const clean = rows.map((r) => ({ label: r.label.trim(), price: Number(r.price) }));
  if (clean.some((r) => !r.label || r.price < 0 || !Number.isFinite(r.price))) return { ok: false, error: "Each drop-in needs a name and a price." };
  return { ok: true, value: clean };
}

export function checkDropInPrice(price: string): Checked<number> {
  const n = Number(price);
  if (price.trim() === "" || !Number.isFinite(n) || n < 0) return { ok: false, error: "Enter the drop-in price." };
  return { ok: true, value: n };
}

/** The drop-in list to start editing from: the saved one, or Kids and Adults. */
export const dropInDraft = (saved: { label: string; price: number }[]): DropInRow[] =>
  saved.length ? saved.map((o) => ({ label: o.label, price: String(o.price) })) : [{ label: "Kids", price: "" }, { label: "Adults", price: "" }];

export function checkLocationName(name: string): Checked<string> {
  const n = name.trim();
  return n ? { ok: true, value: n } : { ok: false, error: "Give the location a name." };
}

import type { SalePartner } from "../../../shared/api/backend";
import { fmt } from "../../../shared/format";
import type { BundleType, ClassSeries, ClientWithPackage, GroupPlanType } from "../../../shared/types";

// Members rules: selling plans and PT packages, refunds, invites and the
// new-client form. Pure functions: no React, no server calls.

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

export type PlanKind = "plan" | "service";

/** A solo owner runs the gym alone: she sells, trains and refunds herself. */
export const isSoloOwner = (role: string | null | undefined, orgMode: string | null | undefined) => role === "dept_head" && orgMode === "solo";

export const normalEmail = (s: string) => s.trim().toLowerCase();
export const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);

/** A group offer value: "pt:<id>" (plan type) or "cs:<id>" (class series). */
export function offerOf(v: string): { planTypeId: string } | { seriesId: string } {
  return v.startsWith("cs:") ? { seriesId: v.slice(3) } : { planTypeId: v.slice(3) };
}

/** The shared bundle the picked offer is, if it is one. */
export const sharedTypeOf = (offer: string, planTypes: GroupPlanType[]) =>
  offer.startsWith("pt:") ? (planTypes.find((t) => t.id === offer.slice(3) && t.sharedSeats) ?? null) : null;

/** Renewing starts from what they had last, still sellable now: one tap to renew, changeable. */
export function renewalPick(client: ClientWithPackage, startIn: "sell-plan" | "renew-package" | undefined, planTypes: GroupPlanType[], series: ClassSeries[], bundleTypes: BundleType[]): string {
  const lastPlan = client.lastGroupPlan;
  const lastOffer = lastPlan?.planTypeId && planTypes.some((t) => t.id === lastPlan.planTypeId) ? `pt:${lastPlan.planTypeId}` : lastPlan?.seriesId && series.some((x) => x.id === lastPlan.seriesId) ? `cs:${lastPlan.seriesId}` : "";
  const lastBundle = client.currentPackage && bundleTypes.some((b) => b.id === client.currentPackage!.bundleTypeId) ? client.currentPackage.bundleTypeId : "";
  return startIn === "sell-plan" ? lastOffer : startIn === "renew-package" ? lastBundle : "";
}

// ---- Selling to an existing client -----------------------------------------

export function checkSellPlan(offer: string, sharedType: GroupPlanType | null, partners: number, clientName: string): string | null {
  if (!offer) return "Choose a plan.";
  if (sharedType && partners < sharedType.sharedSeats! - 1) return `Choose who ${clientName} shares this with.`;
  return null;
}

export function checkSellPackage(bundleTypeId: string, trainer: string, solo: boolean): string | null {
  if (!bundleTypeId || !trainer) return solo ? "Choose a package." : "Choose a package and a coach.";
  return null;
}

export const checkAssign = (coachId: string): string | null => (coachId ? null : "Choose a coach.");

export const checkInvite = (email: string): string | null => (isEmail(email.trim()) ? null : "Enter a valid email.");

// ---- Refunds ----------------------------------------------------------------

export type Refundable = { paid: number; refunded: number; refundable: number };
export type RefundDest = "wallet" | "desk";

/** The amount (no more than what's left to refund) and the note to save. A solo
 * owner's desk refunds go out on InstaPay, so the note says so. */
export function checkRefund(amountText: string, refundable: Refundable | null, clientName: string, solo: boolean, dest: RefundDest, noteText: string): Checked<{ amount: number; note: string | undefined }> {
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter a refund amount." };
  if (refundable && amount > refundable.refundable) {
    return { ok: false, error: refundable.refundable > 0 ? `The most you can refund ${clientName} is ${fmt(refundable.refundable)} EGP.` : `${clientName} has nothing left to refund.` };
  }
  const note = [solo && dest === "desk" ? "InstaPay" : "", noteText.trim()].filter(Boolean).join(" · ");
  return { ok: true, value: { amount, note: note || undefined } };
}

// ---- New client --------------------------------------------------------------

export const NEW_CLIENT_STEPS = ["Client info", "Package", "Payment", "Summary"] as const;

export interface NewClientForm {
  name: string;
  phone: string;
  email: string;
  kind: PlanKind;
  offer: string;
  bundleTypeId: string;
  coachId: string;
}

/** What's wrong with a step, if anything. Email is how the client signs in to
 * the member app, so it's required. Once the client exists, its email no
 * longer counts as taken. */
export function newClientProblem(step: number, f: NewClientForm, ctx: { sharedType: GroupPlanType | null; partners: number; created: boolean; takenEmails: string[] }): string | null {
  const mail = normalEmail(f.email);
  if (step === 0) {
    if (!f.name.trim() || !f.phone.trim()) return "Name and phone number are required.";
    if (!isEmail(mail)) return "Enter the client's email — they sign in to the app with it.";
    if (!ctx.created && ctx.takenEmails.some((e) => normalEmail(e) === mail)) return "Another client already uses this email.";
  }
  if (step === 1) {
    if (f.kind === "plan" && !f.offer) return "Choose a plan.";
    if (ctx.sharedType && ctx.partners < ctx.sharedType.sharedSeats! - 1) return "Choose who this client shares the plan with.";
    if (f.kind === "service" && (!f.bundleTypeId || !f.coachId)) return "Choose a package and a coach.";
  }
  return null;
}

/** The chosen package as the summary describes it. */
export function chosenOffer(f: Pick<NewClientForm, "kind" | "offer" | "bundleTypeId">, planTypes: GroupPlanType[], series: ClassSeries[], bundleTypes: BundleType[]): { title: string; detail: string; price: number } | null {
  if (f.kind === "plan") {
    if (f.offer.startsWith("cs:")) {
      const x = series.find((r) => r.id === f.offer.slice(3));
      return x ? { title: `${x.title} monthly`, detail: "1 month", price: x.monthlyPrice } : null;
    }
    const t = planTypes.find((r) => r.id === f.offer.slice(3));
    if (!t) return null;
    const months = `${t.durationMonths} month${t.durationMonths === 1 ? "" : "s"}`;
    return { title: t.name, detail: t.kind === "bundle" ? `${t.sharedSeats ? `${t.credits! / t.sharedSeats} classes each` : `${t.credits} classes`} · ${months}` : `All classes · ${months}`, price: t.price };
  }
  const b = bundleTypes.find((r) => r.id === f.bundleTypeId);
  return b ? { title: b.name, detail: `${b.sessionsIncluded} PT sessions`, price: b.price } : null;
}

// ---- Shared bundles ------------------------------------------------------------

/** The new partners of a shared sale (no app invite yet), matched to the
 * clients the sale created for them. */
export const partnerInvites = (partners: SalePartner[], sharedWith: { id: string }[] | undefined) =>
  partners.flatMap((p, i) => ("email" in p && sharedWith?.[i] ? [{ id: sharedWith[i].id, email: p.email, name: p.name }] : []));

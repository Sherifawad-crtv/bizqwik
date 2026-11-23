import { fmt } from "../../../shared/format";
import type { GymClass, PayMethod } from "../../../shared/types";

// Drop-in rules: which class sessions can be sold, what a sale needs, and
// what the till shows. Pure functions: no React, no server calls.

const HOUR = 3600000;

export type DropInMode = "class" | "walkin";

/** Sessions the desk can sell a drop-in for: from 2 hours ago to 7 days ahead. */
export const dropInSessions = (classes: GymClass[], now: number) =>
  classes.filter((c) => c.status === "active" && Date.parse(c.startsAt) >= now - 2 * HOUR && Date.parse(c.startsAt) <= now + 7 * 86400000);

/** The next class (the one most drop-ins are for): the first not over an hour in. */
export const nextSessionId = (sessions: GymClass[], now: number) => sessions.find((c) => Date.parse(c.startsAt) + HOUR >= now)?.id ?? "";

export interface DropInSale {
  mode: DropInMode;
  client: { id: string; name: string } | null;
  session: GymClass | null;
  /** Adding a brand-new member on a walk-in. */
  adding: boolean;
  newName: string;
  newPhone: string;
  newEmail: string;
  category: string;
  price: string;
  pay: PayMethod;
}

/** Wallet is only payable for a linked member; a brand-new one has no wallet. */
export const effectivePay = (pay: PayMethod, linked: boolean): PayMethod => (!linked && pay === "wallet" ? "cash" : pay);

export const isNewMember = (s: Pick<DropInSale, "mode" | "client" | "adding">) => s.mode === "walkin" && !s.client && s.adding;

/** The amount on the button, like a till: what is about to be charged. */
export function dropInAmount(s: Pick<DropInSale, "mode" | "session" | "price">): number | null {
  if (s.mode === "class") return s.session ? s.session.price : null;
  return s.price !== "" && Number.isFinite(Number(s.price)) && Number(s.price) >= 0 ? Number(s.price) : null;
}

export const tenderLabel = (pay: PayMethod) => ({ cash: "cash", card: "card", instapay: "InstaPay", wallet: "wallet" })[pay] ?? pay;

/** What's missing before a drop-in can be charged, if anything. Every visit
 * is recorded against a member. */
export function checkDropIn(s: DropInSale): string | null {
  if (s.mode === "class") {
    if (!s.client) return "Link the member first — a class drop-in puts them on the roster.";
    if (!s.session) return "Choose the class session.";
    return null;
  }
  if (!s.client && !s.adding) return "Link the member or add their details — every walk-in is recorded against a member.";
  if (isNewMember(s)) {
    if (!s.newName.trim() || !s.newPhone.trim()) return "Enter the member's name and phone number.";
    if (!/^\S+@\S+\.\S+$/.test(s.newEmail.trim())) return "Enter the member's email — they sign in to the app with it.";
  }
  if (!s.category.trim()) return "Enter what the drop-in is for.";
  const amount = Number(s.price);
  if (s.price === "" || !Number.isFinite(amount) || amount < 0) return "Enter the price paid.";
  return null;
}

/** The line shown once a drop-in is recorded. */
export function dropInDoneLabel(s: DropInSale): string {
  if (s.mode === "class" && s.client && s.session) return `${s.client.name} · ${s.session.title} · ${fmt(s.session.price)} EGP`;
  return `${s.client ? s.client.name : `${s.newName.trim()} (new member · app invite ready)`} · ${s.category.trim()} · ${fmt(Number(s.price))} EGP`;
}

// ---- Solo owner's drop-in ---------------------------------------------------------

type SoloSettings = { dropInOptions: Record<string, { label: string; price: number }[]>; dropInPrices: Record<string, number | null | undefined>; dropInPrice: number | null };

/** A location can sell several drop-ins (Kids / Adults), each with its price;
 * otherwise there's one price, per location when there are 2+. */
export function soloDropInPrice(settings: SoloSettings, here: string | null, kind: string | null) {
  const options = here ? (settings.dropInOptions[here] ?? []) : [];
  const chosen = options.find((o) => o.label === kind) ?? null;
  const price = options.length > 0 ? (chosen?.price ?? null) : here ? (settings.dropInPrices[here] ?? null) : settings.dropInPrice;
  return { options, chosen, price };
}

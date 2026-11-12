import type { BundleType, ClientWithPackage } from "../../lib/types";
import { dateLabel } from "../../lib/format";
import { type PlanSummary, DAY, type StatusTone } from "./shared";

/** One line describing what a client is on right now — an active group plan
 * wins over an active PT package, then whatever lapsed most recently. */
export function planSummary(client: ClientWithPackage, bundleTypes: BundleType[]): PlanSummary {
  const g = client.groupPlan ?? null;
  const p = client.currentPackage;
  const pName = p ? (bundleTypes.find((b) => b.id === p.bundleTypeId)?.name ?? "Package") : "";

  if (g?.frozenUntil) {
    return { tone: "active", title: g.name, detail: `Frozen until ${dateLabel(g.frozenUntil.slice(0, 10))} · restarts by itself` };
  }
  if (g) {
    const detail = g.kind === "bundle" ? `${g.creditsRemaining} of ${g.creditsTotal} classes left` : `Until ${dateLabel(g.expiresAt.slice(0, 10))}`;
    return { tone: "active", title: g.name, detail: p?.status === "active" ? `${detail} · + PT` : detail };
  }
  if (p && p.status === "active") {
    return { tone: "active", title: pName, detail: `${p.sessionsRemaining} of ${p.sessionsIncluded} sessions left` };
  }
  if (p) return { tone: "expired", title: pName, detail: p.status === "exhausted" ? "All sessions used" : `Ended ${dateLabel(p.expiryDate)}` };
  const last = client.lastGroupPlan ?? null;
  if (last) {
    const used = last.kind === "bundle" && (last.creditsRemaining ?? 0) <= 0;
    return { tone: "expired", title: last.name, detail: used ? "All sessions used" : `Ended ${dateLabel(last.expiresAt.slice(0, 10))}` };
  }
  return { tone: "none", title: "No plan", detail: "Nothing active" };
}

/** Is this client's plan about to run out? A running plan ending within a week,
 * or a class pack down to its last two sessions. Returns what's left to say. */
export function endingSoon(client: ClientWithPackage): { days: number | null; label: string } | null {
  const g = client.groupPlan ?? null;
  const p = client.currentPackage && client.currentPackage.status === "active" ? client.currentPackage : null;
  const now = Date.now();
  const daysTo = (iso: string) => Math.ceil((Date.parse(iso) - now) / DAY);
  if (g) {
    const d = daysTo(g.expiresAt);
    if (g.kind === "bundle" && (g.creditsRemaining ?? 0) <= 2) return { days: d, label: `${g.creditsRemaining} session${g.creditsRemaining === 1 ? "" : "s"} left` };
    if (d <= 7) return { days: d, label: d <= 0 ? "Ends today" : d === 1 ? "Ends tomorrow" : `Ends in ${d} days` };
  }
  if (p) {
    const d = daysTo(p.expiryDate);
    if (p.sessionsRemaining <= 2) return { days: d, label: `${p.sessionsRemaining} PT session${p.sessionsRemaining === 1 ? "" : "s"} left` };
    if (d <= 7) return { days: d, label: d <= 0 ? "Ends today" : `Ends in ${d} days` };
  }
  return null;
}

/** WhatsApp wants the number in international form, digits only. An Egyptian
 * mobile typed 010… becomes 2010…; anything already starting with a country
 * code is kept. */
export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  const intl = digits.startsWith("00") ? digits.slice(2) : digits.startsWith("0") ? `20${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** A friendly renewal nudge for a client, ready to edit in WhatsApp. */
export function renewalMessage(client: ClientWithPackage, bundleTypes: BundleType[]): string {
  const first = client.name.trim().split(/\s+/)[0];
  const s = planSummary(client, bundleTypes);
  const ended = s.tone !== "active";
  const what = s.title && s.title !== "No plan" ? s.title : "your plan";
  return ended
    ? `Hi ${first}! Your ${what} has ended. Would you like to renew so you can keep training? 💪`
    : `Hi ${first}! Just a heads up — your ${what} is almost up (${s.detail}). Want me to renew it for you? 💪`;
}

/** What the desk needs to know at a glance: can this person come in, and is
 * anything about to run out? One short label per client, never a plain
 * "active" for someone who is frozen, nearly out, or here for PT only. */
export function deskStatus(client: ClientWithPackage): { tone: StatusTone; label: string } {
  const g = client.groupPlan ?? null;
  const p = client.currentPackage && client.currentPackage.status === "active" ? client.currentPackage : null;
  const now = Date.now();
  const daysTo = (iso: string) => Math.ceil((Date.parse(iso) - now) / DAY);
  const ends = (d: number) => (d <= 0 ? "ENDS TODAY" : d === 1 ? "ENDS TOMORROW" : `ENDS IN ${d} DAYS`);
  if (g?.frozenUntil && Date.parse(g.frozenUntil) > now) return { tone: "frozen", label: "FROZEN" };
  if (g) {
    const d = daysTo(g.expiresAt);
    if (g.kind === "bundle") {
      const n = g.creditsRemaining ?? 0;
      if (n <= 0) return p ? { tone: "pt", label: `PT ONLY · ${p.sessionsRemaining} LEFT` } : { tone: "bad", label: "NO SESSIONS" };
      if (n <= 2) return { tone: "warn", label: `${n} LEFT` };
      if (d <= 7) return { tone: "warn", label: ends(d) };
      return { tone: "good", label: `${n} LEFT` };
    }
    if (d <= 7) return { tone: "warn", label: ends(d) };
    return { tone: "good", label: "ACTIVE" };
  }
  if (p) return { tone: "pt", label: `PT ONLY · ${p.sessionsRemaining} LEFT` };
  if (client.currentPackage || client.lastGroupPlan) return { tone: "bad", label: "EXPIRED" };
  return { tone: "none", label: "NO PLAN" };
}

export function matchesClient(c: ClientWithPackage, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return c.name.toLowerCase().includes(q) || (c.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""));
}

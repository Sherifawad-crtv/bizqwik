import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/EmptyState";
import type { BundleType, ClientWithPackage } from "../../lib/types";
import { dateLabel } from "../../lib/format";

export type PlanTone = "active" | "expired" | "none";

export interface PlanSummary {
  tone: PlanTone;
  title: string;
  detail: string;
}

/** One line describing what a client is on right now — an active group plan
 * wins over an active PT package, then whatever lapsed most recently. */
export function planSummary(client: ClientWithPackage, bundleTypes: BundleType[]): PlanSummary {
  const g = client.groupPlan ?? null;
  const p = client.currentPackage;
  const pName = p ? (bundleTypes.find((b) => b.id === p.bundleTypeId)?.name ?? "Package") : "";

  if (g) {
    const detail = g.kind === "bundle" ? `${g.creditsRemaining} of ${g.creditsTotal} classes left` : `Until ${dateLabel(g.expiresAt.slice(0, 10))}`;
    return { tone: "active", title: g.name, detail: p?.status === "active" ? `${detail} · + PT` : detail };
  }
  if (p && p.status === "active") {
    return { tone: "active", title: pName, detail: `${p.sessionsRemaining} of ${p.sessionsIncluded} sessions left` };
  }
  if (p) return { tone: "expired", title: pName, detail: p.status === "exhausted" ? "All sessions used" : `Ended ${dateLabel(p.expiryDate)}` };
  return { tone: "none", title: "No plan", detail: "Nothing active" };
}

const DAY = 86400000;

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

const TONE: Record<PlanTone, { fg: string; bg: string; label: string }> = {
  active: { fg: "var(--paid-fg)", bg: "var(--paid-bg)", label: "ACTIVE" },
  expired: { fg: "var(--danger-fg)", bg: "var(--danger-bg)", label: "EXPIRED" },
  none: { fg: "var(--ink-muted)", bg: "var(--sunken)", label: "NO PLAN" },
};

export function PlanPill({ tone }: { tone: PlanTone }) {
  const c = TONE[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        font: "700 11px var(--font-mono)",
        letterSpacing: ".08em",
        whiteSpace: "nowrap",
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: 999, background: c.fg, display: "block" }} />
      {c.label}
    </span>
  );
}

export function SheetHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{kicker}</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{title}</div>
    </>
  );
}

export function ErrorBanner({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
      {text}
    </div>
  );
}

export function SectionTitle({ children, count, right }: { children: ReactNode; count?: number | string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 2px 12px" }}>
      <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>{children}</span>
      {count !== undefined && <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{count}</span>}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

/** The "see everything" link that belongs opposite a section's title (the
 * `right` of SectionTitle), never stranded under its list. */
export function SectionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      data-tap
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 2, border: 0, background: "none", color: "var(--primary-pressed)", font: "700 14px var(--font-body)", cursor: "pointer", padding: "6px 0 6px 8px" }}
    >
      {children} <Icon name="chevron-right" size={16} />
    </button>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", ...style }}>
      {children}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Search by name or phone" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label
      data-sq
      style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "0 16px", height: 52 }}
    >
      <span style={{ color: "var(--ink-faint)", display: "flex" }}>
        <Icon name="search" size={18} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ flex: 1, minWidth: 0, border: 0, background: "none", outline: "none", font: "600 16px var(--font-body)", color: "var(--ink)" }}
      />
    </label>
  );
}

export function matchesClient(c: ClientWithPackage, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return c.name.toLowerCase().includes(q) || (c.phone ?? "").replace(/\s/g, "").includes(q.replace(/\s/g, ""));
}

/** Search-as-you-type client list; tapping a row picks it. */
export function ClientPicker({
  clients,
  bundleTypes,
  onPick,
  filter,
  emptyTitle,
  emptyBody,
  onCreate,
}: {
  clients: ClientWithPackage[];
  bundleTypes: BundleType[];
  onPick: (c: ClientWithPackage) => void;
  filter?: (c: ClientWithPackage) => boolean;
  /** When clients exist but none pass `filter` (e.g. nobody has guest passes). */
  emptyTitle?: string;
  emptyBody?: string;
  /** Opens the new-client flow in place (a modal). Without it there is no button. */
  onCreate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const eligible = filter ? clients.filter(filter).length : clients.length;
  const shown = useMemo(() => clients.filter((c) => (!filter || filter(c)) && matchesClient(c, query)).slice(0, 30), [clients, filter, query]);
  return (
    <div>
      <SearchField value={query} onChange={setQuery} />
      <Card style={{ marginTop: 10, overflow: "hidden" }}>
        {shown.map((c, i) => {
          const plan = planSummary(c, bundleTypes);
          return (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 64, padding: "12px 18px", border: 0, borderBottom: i === shown.length - 1 ? "none" : "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {plan.title} · {plan.detail}
                </div>
              </div>
              <PlanPill tone={plan.tone} />
            </button>
          );
        })}
        {shown.length === 0 &&
          (clients.length === 0 ? (
            <EmptyState bare icon="clients" title="No clients yet" body="Register your first client from Clients — then they can be found here." action={onCreate ? { label: "+ New client", onClick: onCreate } : undefined} />
          ) : eligible === 0 ? (
            <EmptyState bare icon="clients" title={emptyTitle ?? "No one to show"} body={emptyBody} />
          ) : (
            <EmptyState bare icon="search" title={`No one matches “${query.trim()}”`} body="Check the spelling, or search by phone number instead." />
          ))}
      </Card>
    </div>
  );
}

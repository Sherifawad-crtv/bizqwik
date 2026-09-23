import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import type { BundleType, ClientWithPackage, MembershipType } from "../../lib/types";
import { dateLabel } from "../../lib/format";

export type PlanTone = "active" | "expired" | "none";

export interface PlanSummary {
  tone: PlanTone;
  title: string;
  detail: string;
}

/** One line describing what a client is on right now — an active membership
 * wins over an active package, then whatever lapsed most recently. */
export function planSummary(client: ClientWithPackage, membershipTypes: MembershipType[], bundleTypes: BundleType[]): PlanSummary {
  const m = client.currentMembership ?? null;
  const p = client.currentPackage;
  const mName = m ? (membershipTypes.find((t) => t.id === m.membershipTypeId)?.name ?? "Membership") : "";
  const pName = p ? (bundleTypes.find((b) => b.id === p.bundleTypeId)?.name ?? "Package") : "";

  if (m && m.status === "active") return { tone: "active", title: mName, detail: `Until ${dateLabel(m.expiryDate)}` };
  if (p && p.status === "active") {
    return { tone: "active", title: pName, detail: `${p.sessionsRemaining} of ${p.sessionsIncluded} sessions left` };
  }
  if (m) return { tone: "expired", title: mName, detail: `Ended ${dateLabel(m.expiryDate)}` };
  if (p) return { tone: "expired", title: pName, detail: p.status === "exhausted" ? "All sessions used" : `Ended ${dateLabel(p.expiryDate)}` };
  return { tone: "none", title: "No plan", detail: "Never bought one" };
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
  membershipTypes,
  bundleTypes,
  onPick,
  filter,
  emptyText = "No clients match.",
}: {
  clients: ClientWithPackage[];
  membershipTypes: MembershipType[];
  bundleTypes: BundleType[];
  onPick: (c: ClientWithPackage) => void;
  filter?: (c: ClientWithPackage) => boolean;
  emptyText?: string;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => clients.filter((c) => (!filter || filter(c)) && matchesClient(c, query)).slice(0, 30), [clients, filter, query]);
  return (
    <div>
      <SearchField value={query} onChange={setQuery} />
      <Card style={{ marginTop: 10, overflow: "hidden" }}>
        {shown.map((c, i) => {
          const plan = planSummary(c, membershipTypes, bundleTypes);
          return (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", border: 0, borderBottom: i === shown.length - 1 ? "none" : "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left" }}
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
        {shown.length === 0 && <div style={{ padding: "22px 18px", textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>{emptyText}</div>}
      </Card>
    </div>
  );
}

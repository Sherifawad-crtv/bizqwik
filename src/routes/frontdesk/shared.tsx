import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/EmptyState";
import type { BundleType, ClientWithPackage } from "../../lib/types";
import { planSummary, deskStatus, matchesClient } from "./deskStatus";

export type PlanTone = "active" | "expired" | "none";

export interface PlanSummary {
  tone: PlanTone;
  title: string;
  detail: string;
}

export const DAY = 86400000;

export type StatusTone = "good" | "warn" | "frozen" | "pt" | "bad" | "none";

const TONE: Record<StatusTone, { fg: string; bg: string }> = {
  good: { fg: "var(--paid-fg)", bg: "var(--paid-bg)" },
  warn: { fg: "var(--logging-fg)", bg: "var(--logging-bg)" },
  frozen: { fg: "var(--frozen-fg)", bg: "var(--frozen-bg)" },
  pt: { fg: "var(--settled-fg)", bg: "var(--settled-bg)" },
  bad: { fg: "var(--danger-fg)", bg: "var(--danger-bg)" },
  none: { fg: "var(--ink-muted)", bg: "var(--sunken)" },
};

export function PlanPill({ client }: { client: ClientWithPackage }) {
  const s = deskStatus(client);
  const c = TONE[s.tone];
  return (
    <span
      data-testid="status-pill"
      data-tone={s.tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        font: "700 var(--fs-caption) var(--font-mono)",
        letterSpacing: ".06em",
        whiteSpace: "nowrap",
        flex: "none",
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: 999, background: c.fg, display: "block" }} />
      {s.label}
    </span>
  );
}

export function SheetHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <div className="bq-label">{kicker}</div>
      <div className="bq-title bq-rise">{title}</div>
    </>
  );
}

export function ErrorBanner({ text }: { text: string }) {
  return (
    <div  className="bq-error bq-error--spaced">
      {text}
    </div>
  );
}

export function SectionTitle({ children, count, right }: { children: ReactNode; count?: number | string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 2px 12px" }}>
      <span className="bq-h2">{children}</span>
      {count !== undefined && <span className="bq-meta">{count}</span>}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

/** The "see everything" link that belongs opposite a section's title (the
 * `right` of SectionTitle), never stranded under its list. */
export function SectionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="bq-scale"
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 2, border: 0, background: "none", color: "var(--primary-pressed)", font: "700 var(--fs-body-sm) var(--font-body)", cursor: "pointer", padding: "6px 0 6px 8px" }}
    >
      {children} <Icon name="chevron-right" size={16} />
    </button>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", ...style }}>
      {children}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Search by name or phone" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "0 16px", height: 52 }}
    >
      <span style={{ color: "var(--ink-faint)", display: "flex" }}>
        <Icon name="search" size={18} />
      </span>
      <input
        data-no-dirty
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ flex: 1, minWidth: 0, border: 0, background: "none", outline: "none", font: "600 var(--fs-base) var(--font-body)", color: "var(--ink)" }}
      />
    </label>
  );
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
              <div className="bq-grow">
                <div style={{ font: "700 var(--fs-base) var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ font: "400 var(--fs-note) var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {plan.title} · {plan.detail}
                </div>
              </div>
              <PlanPill client={c} />
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

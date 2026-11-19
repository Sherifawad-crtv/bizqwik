import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../components/Icon";
import { EmptyState } from "../../components/EmptyState";
import type { BundleType, ClientWithPackage } from "../../lib/types";
import { planSummary, deskStatus, matchesClient } from "./deskStatus";
import { StatusBadge, type Tone } from "../../components/Tag";
import { Card } from "../../components/Card";

export type PlanTone = "active" | "expired" | "none";

export interface PlanSummary {
  tone: PlanTone;
  title: string;
  detail: string;
}

export const DAY = 86400000;

export type StatusTone = "good" | "warn" | "frozen" | "pt" | "bad" | "none";

const TONE: Record<StatusTone, Tone> = { good: "paid", warn: "logging", frozen: "frozen", pt: "settled", bad: "danger", none: "neutral" };

export function PlanPill({ client }: { client: ClientWithPackage }) {
  const s = deskStatus(client);
  return (
    <StatusBadge tone={TONE[s.tone]} data-testid="status-pill" data-tone={s.tone}>
      {s.label}
    </StatusBadge>
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



/** The "see everything" link that belongs opposite a section's title (the
 * `right` of SectionHeader), never stranded under its list. */
export function SectionLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      className="bq-scale"
      onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 2, border: 0, background: "none", color: "var(--color-bg-fill-primary-active)", font: "700 var(--text-subheadline-size) var(--font-family-body)", cursor: "pointer", padding: "6px 0 6px 8px" }}
    >
      {children} <Icon name="chevron-right" size={16} />
    </button>
  );
}


export function SearchField({ value, onChange, placeholder = "Search by name or phone" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--color-bg-surface-secondary-default)", border: "1px solid var(--color-border-primary-default)", borderRadius: "var(--radius-item)", padding: "0 16px", height: 52 }}
    >
      <span style={{ color: "var(--color-text-tertiary-default)", display: "flex" }}>
        <Icon name="search" size={18} />
      </span>
      <input
        data-no-dirty
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        style={{ flex: 1, minWidth: 0, border: 0, background: "none", outline: "none", font: "600 var(--text-callout-size) var(--font-family-body)", color: "var(--color-text-primary-default)" }}
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
      <Card pad="none" style={{ marginTop: 10, overflow: "hidden" }}>
        {shown.map((c, i) => {
          const plan = planSummary(c, bundleTypes);
          return (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className={`bq-plain bq-listrow bq-listrow--compact ${!(i === shown.length - 1) ? "bq-listrow--divider" : ""}`} style={{ width: "100%", minHeight: 64, background: "none", cursor: "pointer", textAlign: "left" }}
            >
              <div className="bq-grow">
                <div style={{ font: "700 var(--text-callout-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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

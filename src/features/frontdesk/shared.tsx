import { cx } from "../../design-system/cx";
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "../../design-system/components/Icon";
import { EmptyState } from "../../design-system/components/EmptyState";
import type { BundleType, ClientWithPackage } from "../../shared/types";
import { planSummary, matchesClient } from "../../shared/deskStatus";
import { Card } from "../../design-system/components/Card";
import { PlanPill } from "../../shared/components/PlanPill";
import "./shared.css";



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
      className="bq-scale bq-frontdesk-shared-section-link-btn"
      onClick={onClick}
    >
      {children} <Icon name="chevron-right" size={16} />
    </button>
  );
}

export function SearchField({ value, onChange, placeholder = "Search by name or phone" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="bq-frontdesk-shared-search-field-label"
    >
      <span className="bq-fg-tertiary bq-flex">
        <Icon name="search" size={18} />
      </span>
      <input className="bq-frontdesk-shared-search-field-input"
        data-no-dirty
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
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
      <Card className="bq-mt-2 bq-overflow-hidden" pad="none">
        {shown.map((c, i) => {
          const plan = planSummary(c, bundleTypes);
          return (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className={cx(`bq-plain bq-listrow bq-listrow--compact ${!(i === shown.length - 1) ? "bq-listrow--divider" : ""}`, "bq-frontdesk-shared-client-picker-btn")}
            >
              <div className="bq-grow">
                <div className="bq-frontdesk-shared-client-picker-title">{c.name}</div>
                <div className="bq-frontdesk-shared-client-picker-meta">
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

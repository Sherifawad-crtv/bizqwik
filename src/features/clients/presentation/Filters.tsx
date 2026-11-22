import { useState, type ReactNode } from "react";
import { todayIso } from "../../../shared/format";
import type { ClientWithPackage } from "../../../shared/types";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { Sheet } from "../../../design-system/components/Sheet";
import { DateField } from "../../../design-system/components/DateField";
import { NO_FILTERS, filterClients, planOptions, type ClientFilters, type ExpiryFilter, type SortKey, type StatusFilter } from "../domain/clientFilters";
import { plusDays } from "../domain/clientText";
import { useNow } from "../../../shared/useNow";
import { Chip } from "../../../design-system/components/Chip";
import "./Filters.css";

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "low", label: "Low" },
  { value: "ended", label: "Ended" },
  { value: "none", label: "No plan" },
];

const EXPIRY_OPTIONS: { value: ExpiryFilter; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "7", label: "Next 7 days" },
  { value: "14", label: "Next 14 days" },
  { value: "30", label: "Next 30 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Pick dates" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "expiry", label: "Expiry · soonest" },
  { value: "expiry_late", label: "Expiry · latest" },
  { value: "left", label: "Sessions left · fewest" },
  { value: "left_most", label: "Sessions left · most" },
];


function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bq-mb-4">
      <div className="bq-clients-filters-filter-group-label">{label}</div>
      <div className="bq-flex bq-wrap bq-gap-2">{children}</div>
    </div>
  );
}

/** Search and one-tap status chips stay on screen; everything else (plan, expiry,
 * coach, sort) lives in one sheet so the roster starts right under them. */
export function ClientFilterBar({
  clients,
  filters,
  onChange,
  coaches,
}: {
  clients: ClientWithPackage[];
  filters: ClientFilters;
  onChange: (f: ClientFilters) => void;
  coaches: { id: string; name: string }[] | null;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<ClientFilters>) => onChange({ ...filters, ...patch });
  const now = useNow();
  const plans = planOptions(clients, now);
  const inSheet = (filters.plan ? 1 : 0) + (filters.coach ? 1 : 0) + (filters.expiry !== "any" ? 1 : 0);
  const count = (status: StatusFilter) => filterClients(clients, { ...NO_FILTERS, status }, now).length;
  const matching = filterClients(clients, filters, now).length;

  return (
    <div className="bq-mb-4" data-testid="client-filters">
      <div className="bq-flex bq-gap-2">
        <label className="bq-clients-filters-client-filter-bar-label"
        >
          <span className="bq-fg-tertiary bq-flex">
            <Icon name="search" size={18} />
          </span>
          <input className="bq-clients-filters-client-filter-bar-input"
            aria-label="Search clients"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="Search clients"
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{ flex: "none", height: 48, padding: "0 16px", display: "flex", alignItems: "center", gap: 8, background: inSheet ? "var(--color-bg-fill-accent-default)" : "var(--color-bg-surface-primary-default)", color: inSheet ? "var(--color-bg-fill-primary-active)" : "var(--color-text-primary-default)", border: `1px solid ${inSheet ? "var(--color-bg-fill-primary-default)" : "var(--color-border-primary-default)"}`, borderRadius: "var(--radius-item)", font: "700 var(--text-body-size) var(--font-family-body)", cursor: "pointer" }}
        >
          Filters
          {inSheet > 0 && (
            <span className="bq-clients-filters-client-filter-bar-title" data-testid="filter-badge">
              {inSheet}
            </span>
          )}
        </button>
      </div>

      <div className="bq-clients-filters-client-filter-bar-row">
        {STATUS_CHIPS.map((o) => (
          <Chip key={o.value} on={filters.status === o.value} onClick={() => set({ status: o.value })} testId={`status-${o.value}`}>
            {o.label} <span className="tabular bq-clients-filters-client-filter-bar-part">{count(o.value)}</span>
          </Chip>
        ))}
      </div>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="bq-clients-filters-client-filter-bar-title-2">Filters</div>

        <FilterGroup label="PLAN">
          <Chip on={filters.plan === ""} onClick={() => set({ plan: "" })}>All plans</Chip>
          {plans.map((p) => (
            <Chip key={p.name} on={filters.plan === p.name} onClick={() => set({ plan: p.name })}>
              {p.name} <span className="tabular bq-clients-filters-client-filter-bar-part-2">{p.count}</span>
            </Chip>
          ))}
        </FilterGroup>

        <FilterGroup label="EXPIRES">
          {EXPIRY_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              on={filters.expiry === o.value}
              onClick={() => set(o.value === "custom" && !filters.from ? { expiry: o.value, from: todayIso(), to: plusDays(todayIso(), 30) } : { expiry: o.value })}
            >
              {o.label}
            </Chip>
          ))}
        </FilterGroup>
        {filters.expiry === "custom" && (
          <div className="bq-clients-filters-client-filter-bar-grid">
            <div>
              <div className="bq-clients-filters-client-filter-bar-label-2">FROM</div>
              <DateField value={filters.from || todayIso()} max={filters.to || undefined} onChange={(from) => set({ from })} />
            </div>
            <div>
              <div className="bq-clients-filters-client-filter-bar-label-2">TO</div>
              <DateField value={filters.to || plusDays(todayIso(), 30)} min={filters.from || undefined} onChange={(to) => set({ to })} />
            </div>
          </div>
        )}

        {coaches && coaches.length > 0 && (
          <FilterGroup label="COACH">
            <Chip on={filters.coach === ""} onClick={() => set({ coach: "" })}>All coaches</Chip>
            <Chip on={filters.coach === "none"} onClick={() => set({ coach: "none" })}>Unassigned</Chip>
            {coaches.map((c) => (
              <Chip key={c.id} on={filters.coach === c.id} onClick={() => set({ coach: c.id })}>
                {c.name}
              </Chip>
            ))}
          </FilterGroup>
        )}

        <FilterGroup label="SORT BY">
          {SORT_OPTIONS.map((o) => (
            <Chip key={o.value} on={filters.sort === o.value} onClick={() => set({ sort: o.value })}>
              {o.label}
            </Chip>
          ))}
        </FilterGroup>

        <Button fullWidth size="lg" onClick={() => setOpen(false)}>
          Show {matching} {matching === 1 ? "client" : "clients"}
        </Button>
        <Button className="bq-mt-2" variant="quiet" fullWidth onClick={() => onChange({ ...NO_FILTERS })}>
          Reset all
        </Button>
      </Sheet>
    </div>
  );
}

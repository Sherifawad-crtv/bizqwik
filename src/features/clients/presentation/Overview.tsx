import type { ClientWithPackage } from "../../../shared/types";
import { NO_FILTERS, type ClientFilters } from "../domain/clientFilters";
import { rosterCounts } from "../domain/roster";
import { useNow } from "../../../shared/hooks/useNow";
import "./Overview.css";

export function OverviewCards({ clients, showGroupPlans, onPick }: { clients: ClientWithPackage[]; showGroupPlans: boolean; onPick: (patch: Partial<ClientFilters>) => void }) {
  const now = useNow();
  const n = rosterCounts(clients, now);
  const stats: { k: string; v: number; patch: Partial<ClientFilters> }[] = [
    { k: "TOTAL CLIENTS", v: n.total, patch: {} },
    ...(showGroupPlans ? [{ k: "ON A GROUP PLAN", v: n.onGroupPlan, patch: {} }] : []),
    { k: "ACTIVE", v: n.active, patch: { status: "active" } },
    { k: "NEEDS RENEWAL", v: n.needsRenewal, patch: { status: "ended" } },
    { k: "EXPIRING SOON", v: n.expiringSoon, patch: { status: "active", expiry: "7" } },
  ];
  return (
    <div className="bq-clients-overview-cards-grid">
      {stats.map((s) => (
        <button
          key={s.k}
          onClick={() => onPick({ ...NO_FILTERS, ...s.patch })}
          className="bq-card bq-clients-overview-cards-btn"
        >
          <div className="bq-label">{s.k}</div>
          <div className="tabular bq-clients-overview-cards-title">{s.v}</div>
        </button>
      ))}
    </div>
  );
}

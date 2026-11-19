import type { ClientWithPackage } from "../../shared/types";
import { NO_FILTERS, planFacts, type ClientFilters } from "./clientFilters";
import { EXPIRING_SOON_DAYS } from "./helpers";
import { useNow } from "../../shared/useNow";
import "./Overview.css";

export function OverviewCards({ clients, showGroupPlans, onPick }: { clients: ClientWithPackage[]; showGroupPlans: boolean; onPick: (patch: Partial<ClientFilters>) => void }) {
  const now = useNow();
  const facts = clients.map((c) => planFacts(c, now));
  const stats: { k: string; v: number; patch: Partial<ClientFilters> }[] = [
    { k: "TOTAL CLIENTS", v: clients.length, patch: {} },
    ...(showGroupPlans ? [{ k: "ON A GROUP PLAN", v: clients.filter((c) => c.groupPlan).length, patch: {} }] : []),
    { k: "ACTIVE", v: facts.filter((f) => f.state === "active").length, patch: { status: "active" } },
    { k: "NEEDS RENEWAL", v: facts.filter((f) => f.state === "ended").length, patch: { status: "ended" } },
    { k: "EXPIRING SOON", v: facts.filter((f) => f.state === "active" && f.daysLeft !== null && f.daysLeft <= EXPIRING_SOON_DAYS).length, patch: { status: "active", expiry: "7" } },
  ];
  return (
    <div className="bq-clients-overview-overview-cards-grid">
      {stats.map((s) => (
        <button
          key={s.k}
          onClick={() => onPick({ ...NO_FILTERS, ...s.patch })}
          className="bq-card bq-clients-overview-overview-cards-btn"
        >
          <div className="bq-label">{s.k}</div>
          <div className="tabular bq-clients-overview-overview-cards-title">{s.v}</div>
        </button>
      ))}
    </div>
  );
}

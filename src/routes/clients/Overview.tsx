import type { ClientWithPackage } from "../../lib/types";
import { NO_FILTERS, planFacts, type ClientFilters } from "../../lib/clientFilters";
import { EXPIRING_SOON_DAYS } from "./helpers";

export function OverviewCards({ clients, showGroupPlans, onPick }: { clients: ClientWithPackage[]; showGroupPlans: boolean; onPick: (patch: Partial<ClientFilters>) => void }) {
  const now = Date.now();
  const facts = clients.map((c) => planFacts(c, now));
  const stats: { k: string; v: number; patch: Partial<ClientFilters> }[] = [
    { k: "TOTAL CLIENTS", v: clients.length, patch: {} },
    ...(showGroupPlans ? [{ k: "ON A GROUP PLAN", v: clients.filter((c) => c.groupPlan).length, patch: {} }] : []),
    { k: "ACTIVE", v: facts.filter((f) => f.state === "active").length, patch: { status: "active" } },
    { k: "NEEDS RENEWAL", v: facts.filter((f) => f.state === "ended").length, patch: { status: "ended" } },
    { k: "EXPIRING SOON", v: facts.filter((f) => f.state === "active" && f.daysLeft !== null && f.daysLeft <= EXPIRING_SOON_DAYS).length, patch: { status: "active", expiry: "7" } },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 18 }}>
      {stats.map((s) => (
        <button
          key={s.k}
          onClick={() => onPick({ ...NO_FILTERS, ...s.patch })}
          style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 18px", cursor: "pointer" }}
        >
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{s.k}</div>
          <div className="tabular" style={{ font: "800 30px var(--font-body)", letterSpacing: "-.02em", marginTop: 6, color: "var(--ink)" }}>{s.v}</div>
        </button>
      ))}
    </div>
  );
}

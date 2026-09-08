import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { fmt } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { MonthPicker } from "../components/MonthPicker";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { Spinner } from "../components/Spinner";
import { canLog } from "../lib/types";

export function Oversight() {
  const [month, setMonth] = useState(MOCK.CURRENT_MONTH);
  const navigate = useNavigate();

  const { data } = useAsync(() => api.month(month), [month]);

  useSetHeader({ kicker: "DEPARTMENT", title: "Oversight", right: <MonthPicker month={month} onChange={setMonth} /> }, [month]);

  if (!data) return <Spinner />;
  const rows = data.rows.filter((r) => canLog(r.role));
  const closed = rows.filter((r) => r.state !== "logging").length;
  const progressPct = rows.length ? Math.round((closed / rows.length) * 100) : 0;

  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
    title: r.name,
    meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? "NO TIER"}`,
    state: r.state,
    amount: r.total,
    onClick: () => navigate(`/coaches/${r.coachId}`, { state: { month } }),
  }));

  return (
    <div>
      <MoneyHero
        label="DEPT PAYOUT RUN RATE · EGP"
        value={fmt(rows.reduce((s, r) => s + r.total, 0))}
        stats={[
          { k: "COACHES", v: String(rows.length) },
          { k: "SESSIONS", v: String(rows.reduce((s, r) => s + r.count, 0)) },
          { k: "CLOSED", v: `${closed} of ${rows.length}` },
        ]}
      />

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "16px 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>SETTLED + PAID PROGRESS</span>
          <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-muted)" }}>{progressPct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: "var(--sunken)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: "var(--primary)", borderRadius: 999, transition: "width .3s ease" }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Signals</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{rows.length} coaches</span>
      </div>
      <RollupTable colA="COACH" colB="ACTIVITY" rows={rowItems} />
      <div style={{ padding: "18px 4px 0", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
        Oversight is read-only — settlement still happens on the coach record.
      </div>
    </div>
  );
}

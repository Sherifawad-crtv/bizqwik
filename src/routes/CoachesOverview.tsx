import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { fmt } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { MonthPicker } from "../components/MonthPicker";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { canLog } from "../lib/types";

export function CoachesOverview() {
  const [month, setMonth] = useState(MOCK.CURRENT_MONTH);
  const navigate = useNavigate();

  const { data, loading } = useAsync(() => api.month(month), [month]);

  useSetHeader({ kicker: "CALISTHENICS DEPT", title: "Coaches", right: <MonthPicker month={month} onChange={setMonth} /> }, [month]);

  if (loading || !data) return null;
  const rows = data.rows.filter((r) => canLog(r.role));

  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
    title: r.name,
    meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? "NO TIER"}`,
    sub: r.state === "paid" && r.paidAt ? `PAID` : r.state === "settled" ? "AWAITING PAY" : "IN PROGRESS",
    state: r.state,
    amount: r.total,
    onClick: () => navigate(`/coaches/${r.coachId}`, { state: { month } }),
  }));

  return (
    <div>
      <MoneyHero
        label="MONTH TOTAL · EGP"
        value={fmt(rows.reduce((s, r) => s + r.total, 0))}
        stats={[
          { k: "COACHES", v: String(rows.length) },
          { k: "SESSIONS", v: String(rows.reduce((s, r) => s + r.count, 0)) },
          { k: "STILL LOGGING", v: String(rows.filter((r) => r.state === "logging").length) },
        ]}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Roster</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{rows.length} coaches</span>
      </div>
      <RollupTable colA="COACH" colB="ACTIVITY" rows={rowItems} />
      <div style={{ padding: "18px 4px 0", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
        Tap a coach to review their sessions and settle the month.
      </div>
    </div>
  );
}

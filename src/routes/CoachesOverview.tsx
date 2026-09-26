import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { fmt } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { Spinner } from "../components/Spinner";
import { canLog } from "../lib/types";
import { useAuth } from "../lib/auth";
import { Icon } from "../components/Icon";

export function CoachesOverview() {
  const month = MOCK.CURRENT_MONTH;
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data } = useAsync(() => api.month(month), [month]);

  useSetHeader({ kicker: "CALISTHENICS DEPT", title: "Team" }, []);

  if (!data) return <Spinner />;
  const rows = data.rows.filter((r) => canLog(r.role));

  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
    avatarUrl: r.avatarUrl,
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
      {profile?.role === "dept_head" && (
        <button
          onClick={() => navigate("/manage")}
          data-sq
          style={{ width: "100%", marginBottom: 14, textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
        >
          <span style={{ color: "var(--primary-pressed)", display: "flex" }}>
            <Icon name="settings" size={20} />
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", font: "700 15px var(--font-body)" }}>Team & tiers</span>
            <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>Pay tiers, staff invites and people</span>
          </span>
          <Icon name="chevron-right" size={18} />
        </button>
      )}
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

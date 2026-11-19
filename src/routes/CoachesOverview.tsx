import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { MoneyHero } from "../components/MoneyHero";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { Spinner } from "../components/Spinner";
import { canLog } from "../lib/types";
import { useAuth } from "../lib/auth";
import { Icon } from "../components/Icon";
import { InviteFlow } from "./manage/Invites";
import { Num } from "../components/Num";

export function CoachesOverview() {
  const month = MOCK.CURRENT_MONTH;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [inviting, setInviting] = useState(false);

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
    onClick: () => navigate(`/coaches/${r.coachId}`, { state: { month, from: "team" } }),
  }));

  return (
    <div>
      <MoneyHero
        label="MONTH TOTAL · EGP"
        value={<Num value={rows.reduce((s, r) => s + r.total, 0)} />}
        stats={[
          { k: "COACHES", v: String(rows.length) },
          { k: "SESSIONS", v: String(rows.reduce((s, r) => s + r.count, 0)) },
          { k: "STILL LOGGING", v: String(rows.filter((r) => r.state === "logging").length) },
        ]}
      />
      {profile?.role === "dept_head" && (
        <button
          onClick={() => navigate("/manage")}
          className="bq-card" style={{ width: "100%", marginBottom: 14, textAlign: "left", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
        >
          <span style={{ color: "var(--color-bg-fill-primary-active)", display: "flex" }}>
            <Icon name="settings" size={20} />
          </span>
          <span className="bq-grow">
            <span style={{ display: "block", font: "700 var(--text-body-size) var(--font-family-body)" }}>Team & tiers</span>
            <span style={{ display: "block", font: "400 var(--text-caption-1-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", marginTop: 2 }}>Pay tiers, staff invites and people</span>
          </span>
          <Icon name="chevron-right" size={18} />
        </button>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span className="bq-h2">Roster</span>
        <span className="bq-meta">{rows.length} coaches</span>
      </div>
      <RollupTable
        colA="COACH"
        colB="ACTIVITY"
        rows={rowItems}
        empty={
          profile?.role === "dept_head"
            ? { title: "No coaches on the team yet", body: "Invite coaches and head coaches by email. They show up here, with their sessions and pay, once they sign up.", action: { label: "Invite someone", onClick: () => setInviting(true) } }
            : { title: "No coaches on the team yet", body: "The department head invites coaches. They show up here once they sign up." }
        }
      />
      <div style={{ padding: "18px 4px 0", font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>
        {rows.length > 0 ? "Tap a coach to review their sessions and settle the month." : null}
      </div>
      <InviteFlow open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}

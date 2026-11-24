import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../../../shared/screen/header";
import { MoneyHero } from "../../../design-system/components/MoneyHero";
import { RollupTable, type ListRow } from "./RollupTable";
import { Spinner } from "../../../design-system/components/Spinner";
import { useAuth } from "../../../shared/session/auth";
import { Icon } from "../../../design-system/components/Icon";
import { InviteFlow } from "../../../shared/components/InviteFlow";
import { Num } from "../../../design-system/components/Num";
import { stillLogging, sumSessions, sumTotal } from "../domain/payroll";
import { CURRENT_MONTH, useTeamMonth } from "./hooks/useCoaches";
import "./CoachesOverview.css";

export function CoachesOverview() {
  const month = CURRENT_MONTH;
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [inviting, setInviting] = useState(false);

  const rows = useTeamMonth(month);

  useSetHeader({ kicker: "CALISTHENICS DEPT", title: "Team" }, []);

  if (!rows) return <Spinner />;

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
        value={<Num value={sumTotal(rows)} />}
        stats={[
          { k: "COACHES", v: String(rows.length) },
          { k: "SESSIONS", v: String(sumSessions(rows)) },
          { k: "STILL LOGGING", v: String(stillLogging(rows)) },
        ]}
      />
      {profile?.role === "dept_head" && (
        <button
          onClick={() => navigate("/manage")}
          className="bq-card bq-coaches-overview-btn"
        >
          <span className="bq-coaches-overview-row">
            <Icon name="settings" size={20} />
          </span>
          <span className="bq-grow">
            <span className="bq-coaches-overview-title">Team & tiers</span>
            <span className="bq-coaches-overview-meta">Pay tiers, staff invites and people</span>
          </span>
          <Icon name="chevron-right" size={18} />
        </button>
      )}
      <div className="bq-coaches-overview-row-2">
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
      <div className="bq-coaches-overview-meta-2">
        {rows.length > 0 ? "Tap a coach to review their sessions and settle the month." : null}
      </div>
      <InviteFlow open={inviting} onClose={() => setInviting(false)} />
    </div>
  );
}

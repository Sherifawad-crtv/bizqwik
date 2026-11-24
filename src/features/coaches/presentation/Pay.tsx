import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/session/auth";
import { useSetHeader } from "../../../shared/screen/header";
import { fmt, monthLabel } from "../../../shared/format";
import { dueByMonth, isPartPaid, monthStatus, sumRemaining, sumSessions } from "../domain/payroll";
import { CURRENT_MONTH, usePayableYear } from "./hooks/useCoaches";
import { HomeAvatar } from "../../../shared/components/HomeAvatar";
import { MoneyHero } from "../../../design-system/components/MoneyHero";
import { RollupTable, type ListRow } from "./RollupTable";
import { Spinner } from "../../../design-system/components/Spinner";
import { StatePill } from "../../../shared/components/StatePill";
import type { Rollup } from "../../../shared/types";
import { Num } from "../../../design-system/components/Num";
import "./Pay.css";

/** Where this month stands: paid out, still to pay, and still being logged. */
function MonthStatus({ rows }: { rows: Rollup[] }) {
  const parts = monthStatus(rows);
  return (
    <div className="bq-card bq-coaches-pay-month-status-spacing">
      <div className="bq-label">THIS MONTH · {monthLabel(CURRENT_MONTH).toUpperCase()}</div>
      <div className="bq-mt-3 bq-flex bq-col bq-gap-2">
        {parts.map((p) => (
          <div className="bq-flex bq-items-center bq-gap-2" key={p.state}>
            <StatePill state={p.state} label={p.label} />
            <span className="bq-meta">{p.n} {p.n === 1 ? "coach" : "coaches"}</span>
            <span className="tabular bq-coaches-pay-month-status-title">{fmt(p.total)} EGP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pay() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const data = usePayableYear();

  useSetHeader({ kicker: "SETTLED · READY", title: "To Pay" }, []);

  if (!profile) return null;
  if (!data) return <Spinner />;

  // Everything settled but not yet paid, in any month of the year. Oldest first.
  const due = dueByMonth(data);
  const dueRows = due.flatMap((m) => m.rows);
  const thisMonth = data.find((m) => m.month === CURRENT_MONTH)?.rows ?? [];

  const listRows = (month: string, rows: Rollup[]): ListRow[] =>
    rows.map((r) => ({
      id: r.coachId,
      name: r.name,
      avatarUrl: r.avatarUrl,
      title: r.name,
      meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? ""}`,
      sub: isPartPaid(r)
        ? `PART PAID · ${fmt(r.paidAmount)} OF ${fmt(r.total)}`
        : `SETTLED ${r.settledAt ? new Date(r.settledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase() : ""}`.trim(),
      state: r.state,
      amount: r.remaining,
      onClick: () => navigate(`/pay/${r.coachId}`, { state: { month, from: "pay" } }),
    }));

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

      <MoneyHero
        label="DUE NOW · EGP"
        value={<Num value={sumRemaining(dueRows)} />}
        stats={[
          { k: "PAYEES", v: String(dueRows.length) },
          { k: "SESSIONS", v: String(sumSessions(dueRows)) },
          { k: "MONTHS", v: String(due.length) },
        ]}
      />

      <MonthStatus rows={thisMonth} />

      <div className="bq-coaches-pay-row">
        <span className="bq-h2">Payout queue</span>
        <span className="bq-meta">{dueRows.length} due</span>
      </div>

      {due.length === 0 ? (
        <RollupTable colA="PAYEE" colB="METHOD" rows={[]} empty={{ icon: "topay", title: "Nothing to pay right now", body: "A coach appears here once a head settles their month. Paid months move to History." }} />
      ) : (
        due.map((m) => (
          <div className="bq-mb-4" key={m.month}>
            <div className="bq-coaches-pay-row-2">
              <span className="bq-label">{monthLabel(m.month).toUpperCase()}</span>
              <span className="tabular bq-coaches-pay-meta">{fmt(sumRemaining(m.rows))} EGP</span>
            </div>
            <RollupTable colA="PAYEE" colB="METHOD" rows={listRows(m.month, m.rows)} />
          </div>
        ))
      )}
      <div className="bq-coaches-pay-meta-2">
        {dueRows.length > 0 ? "Tap a payee to see the full breakdown before paying." : null}
      </div>
    </div>
  );
}

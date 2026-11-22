import { EmptyState } from "../../../design-system/components/EmptyState";
import { useSticky } from "../../../design-system/hooks/useSticky";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth";
import { useSetHeader } from "../../../shared/screen/header";
import { fmt, formatDateTime, monthLabel } from "../../../shared/format";
import { daysLogged, stateLabel, stillLogging, sumSessions, sumTotal } from "../domain/payroll";
import { CURRENT_MONTH, useLedger, yearMonths } from "./hooks/useCoaches";
import { MoneyHero } from "../../../design-system/components/MoneyHero";
import { YearMonthStrip } from "../../../design-system/components/YearMonthStrip";
import { RollupTable, type ListRow } from "./RollupTable";
import { DayList } from "../../../shared/components/DayList";
import { LockedBanner } from "./LockedBanner";
import { Spinner } from "../../../design-system/components/Spinner";
import { Segmented } from "../../../design-system/components/Segmented";
import { ActivityPanel } from "../../../shared/components/ActivityPanel";
import { isHead } from "../../../shared/types";
import type { Rollup, Session } from "../../../shared/types";
import { Num } from "../../../design-system/components/Num";
import "./History.css";

function PersonalHistory({ row, sessions }: { row: Rollup | null; sessions: Session[] }) {
  if (!row) {
    return (
      <EmptyState icon="history" title="Nothing recorded this month" body="Pick another month above to see its sessions and pay." />
    );
  }

  return (
    <>
      <LockedBanner state={row.state} />
      <MoneyHero
        label="TOTAL · EGP"
        value={<Num value={row.total} />}
        stats={[
          { k: "SESSIONS", v: `${row.count} ${row.count === 1 ? "session" : "sessions"}` },
          { k: row.tierName ? row.tierName.toUpperCase() : "RATE", v: `${row.rate} / session` },
          { k: "STATE", v: stateLabel(row) },
          ...(row.paidAmount > 0 && row.state !== "paid" ? [{ k: "RECEIVED", v: `${fmt(row.paidAmount)} of ${fmt(row.total)} EGP` }] : []),
        ]}
      />
      <div className="bq-coaches-history-personal-history-row">
        <span className="bq-label">DAYS LOGGED</span>
        <span className="bq-coaches-history-personal-history-meta">
          {daysLogged(sessions)} {daysLogged(sessions) === 1 ? "DAY" : "DAYS"}
        </span>
      </div>
      <DayList sessions={sessions} rate={row.rate} state={row.state} onOpenDay={() => {}} emptyHint="No sessions were logged this month. Pick another month above to look back." />
    </>
  );
}

function RosterHistory({ rows, month, paidOnly, ytdPaid, onOpenCoach }: { rows: Rollup[]; month: string; paidOnly: boolean; ytdPaid?: number; onOpenCoach?: (id: string) => void }) {
  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
    avatarUrl: r.avatarUrl,
    title: r.name,
    meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? "NO TIER"}`,
    sub: paidOnly
      ? r.paidAt
        ? `PAID ${formatDateTime(r.paidAt)}`
        : undefined
      : r.state === "paid"
        ? "PAID"
        : r.state === "settled"
          ? "AWAITING PAY"
          : "IN PROGRESS",
    state: r.state,
    amount: r.total,
    onClick: onOpenCoach ? () => onOpenCoach(r.coachId) : undefined,
  }));

  return (
    <>
      <MoneyHero
        label={`${paidOnly ? "PAID" : "MONTH TOTAL"} · EGP`}
        value={<Num value={sumTotal(rows)} />}
        stats={
          paidOnly
            ? [
                { k: "PAYEES", v: String(rows.length) },
                { k: "SESSIONS", v: String(sumSessions(rows)) },
                { k: "YEAR TO DATE", v: `${fmt(ytdPaid ?? 0)} EGP` },
              ]
            : [
                { k: "COACHES", v: String(rows.length) },
                { k: "SESSIONS", v: String(sumSessions(rows)) },
                { k: "STILL LOGGING", v: String(stillLogging(rows)) },
              ]
        }
      />
      <RollupTable
        colA={paidOnly ? "PAYEE" : "COACH"}
        colB={paidOnly ? "METHOD" : "ACTIVITY"}
        rows={rowItems}
        empty={
          paidOnly
            ? { icon: "history", title: `No payouts for ${monthLabel(month)}`, body: "Coaches paid for this month appear here. Pick another month above to look back." }
            : { icon: "history", title: `No coach activity in ${monthLabel(month)}`, body: "Sessions and pay for this month appear here once coaches log them. Pick another month above to look back." }
        }
      />
    </>
  );
}

export function History() {
  const { profile } = useAuth();
  // The dept_head's History holds both ledgers: coach payouts and the member
  // activity feed (moved here from the home screen).
  const [view, setView] = useSticky<"payouts" | "activity">("view", "payouts", { url: true, valid: (v) => v === "payouts" || v === "activity" });
  useSetHeader({ kicker: "LEDGER", title: "History" }, []);
  if (profile?.role === "dept_head") {
    return (
      <div>
        <div className="bq-flex bq-justify-center bq-mb-4">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "payouts", label: "PAYOUTS" },
              { value: "activity", label: "ACTIVITY" },
            ]}
          />
        </div>
        <div key={view} className="bq-rise">
          {view === "payouts" ? <LedgerHistory /> : <ActivityPanel />}
        </div>
      </div>
    );
  }
  return <LedgerHistory />;
}

function LedgerHistory() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const months = yearMonths();
  const [month, setMonth] = useSticky("month", CURRENT_MONTH, { url: true, valid: (v) => months.includes(v) });

  const isDeptView = !!profile && isHead(profile.role);
  const isAccountant = profile?.role === "accountant";
  const isPersonal = !!profile && !isDeptView && !isAccountant;

  const data = useLedger(profile, month, { personal: isPersonal, accountant: isAccountant });

  if (!profile) return null;

  return (
    <div>
      <YearMonthStrip months={months} value={month} onChange={setMonth} />
      {!data ? (
        <Spinner />
      ) : data.kind === "personal" ? (
        <PersonalHistory row={data.row} sessions={data.sessions} />
      ) : (
        <RosterHistory
          rows={data.rows}
          month={month}
          paidOnly={isAccountant}
          ytdPaid={data.ytdPaid}
          onOpenCoach={isDeptView ? (id) => navigate(`/coaches/${id}`, { state: { month, from: "history" } }) : isAccountant ? (id) => navigate(`/pay/${id}`, { state: { month, from: "history" } }) : undefined}
        />
      )}
    </div>
  );
}

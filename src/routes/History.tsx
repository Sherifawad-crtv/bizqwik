import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { fmt, formatDateTime } from "../lib/format";
import { currentYearMonths } from "../lib/months";
import { MoneyHero } from "../components/MoneyHero";
import { YearMonthStrip } from "../components/YearMonthStrip";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { DayList } from "../components/DayList";
import { LockedBanner } from "../components/LockedBanner";
import { Spinner } from "../components/Spinner";
import { canLog, isHead } from "../lib/types";
import type { Rollup, Session } from "../lib/types";

interface PersonalData {
  kind: "personal";
  row: Rollup | null;
  sessions: Session[];
}

interface RosterData {
  kind: "roster";
  rows: Rollup[];
}

function PersonalHistory({ row, sessions }: { row: Rollup | null; sessions: Session[] }) {
  if (!row) {
    return (
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "32px 16px", textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
        No record for this month.
      </div>
    );
  }

  return (
    <>
      <LockedBanner state={row.state} />
      <MoneyHero
        label="TOTAL · EGP"
        value={fmt(row.total)}
        stats={[
          { k: "SESSIONS", v: `${row.count} ${row.count === 1 ? "session" : "sessions"}` },
          { k: row.tierName ? row.tierName.toUpperCase() : "RATE", v: `${row.rate} / session` },
          { k: "STATE", v: row.state.toUpperCase() },
        ]}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>DAYS LOGGED</span>
        <span style={{ marginLeft: "auto", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
          {new Set(sessions.map((s) => s.date)).size} {new Set(sessions.map((s) => s.date)).size === 1 ? "DAY" : "DAYS"}
        </span>
      </div>
      <DayList sessions={sessions} rate={row.rate} state={row.state} onOpenDay={() => {}} />
    </>
  );
}

function RosterHistory({ rows, month, paidOnly, onOpenCoach }: { rows: Rollup[]; month: string; paidOnly: boolean; onOpenCoach?: (id: string) => void }) {
  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
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
        value={fmt(rows.reduce((s, r) => s + r.total, 0))}
        stats={
          paidOnly
            ? [
                { k: "PAYEES", v: String(rows.length) },
                { k: "SESSIONS", v: String(rows.reduce((s, r) => s + r.count, 0)) },
                { k: "MONTH", v: month },
              ]
            : [
                { k: "COACHES", v: String(rows.length) },
                { k: "SESSIONS", v: String(rows.reduce((s, r) => s + r.count, 0)) },
                { k: "STILL LOGGING", v: String(rows.filter((r) => r.state === "logging").length) },
              ]
        }
      />
      <RollupTable colA={paidOnly ? "PAYEE" : "COACH"} colB={paidOnly ? "METHOD" : "ACTIVITY"} rows={rowItems} />
    </>
  );
}

export function History() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [month, setMonth] = useState(MOCK.CURRENT_MONTH);
  const months = currentYearMonths();

  const isDeptView = !!profile && isHead(profile.role);
  const isAccountant = profile?.role === "accountant";
  const isPersonal = !!profile && !isDeptView && !isAccountant;

  const { data } = useAsync<PersonalData | RosterData | null>(async () => {
    if (!profile) return null;
    if (isPersonal) {
      const [monthRes, sessionsRes] = await Promise.all([api.month(month), api.sessions(profile.id, month)]);
      return { kind: "personal", row: monthRes.rows.find((r) => r.coachId === profile.id) ?? null, sessions: sessionsRes.sessions };
    }
    const monthRes = await api.month(month);
    const rows = monthRes.rows.filter((r) => canLog(r.role) && (!isAccountant || r.state === "paid"));
    return { kind: "roster", rows };
  }, [profile?.id, profile?.role, month]);

  useSetHeader({ kicker: "LEDGER", title: "History" }, []);

  if (!profile) return null;

  return (
    <div>
      <YearMonthStrip months={months} value={month} onChange={setMonth} />
      {!data ? (
        <Spinner />
      ) : data.kind === "personal" ? (
        <PersonalHistory row={data.row} sessions={data.sessions} />
      ) : (
        <RosterHistory rows={data.rows} month={month} paidOnly={isAccountant} onOpenCoach={isDeptView ? (id) => navigate(`/coaches/${id}`, { state: { month } }) : undefined} />
      )}
    </div>
  );
}

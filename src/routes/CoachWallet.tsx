import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useOwnMonth } from "../lib/ownMonth";
import { useAsync } from "../lib/useAsync";
import { api } from "../lib/backend";
import { isHead } from "../lib/types";
import { fmt, monthShort } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { LockedBanner } from "../components/LockedBanner";
import { DayList } from "../components/DayList";
import { DaySessionsSheet } from "../components/DaySessionsSheet";
import { MonthSwitcherSheet } from "../components/MonthSwitcherSheet";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";

export function CoachWallet() {
  const { profile } = useAuth();
  const { month, setMonth } = useOwnMonth();
  const [monthSheet, setMonthSheet] = useState(false);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, refetch } = useAsync(async () => {
    if (!profile) return null;
    const [monthRes, sessionsRes] = await Promise.all([api.month(month), api.sessions(profile.id, month)]);
    return { row: monthRes.rows.find((r) => r.coachId === profile.id) ?? null, sessions: sessionsRes.sessions };
  }, [profile?.id, month]);

  useSetHeader(
    {
      kicker: monthShort(month),
      title: "My Month",
      right: (
        <button
          onClick={() => setMonthSheet(true)}
          data-sq
          style={{ padding: "8px 12px", borderRadius: 16, border: 0, background: "var(--primary-tint)", font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--primary-pressed)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
        >
          {monthShort(month)} <Icon name="chevron-down" size={13} />
        </button>
      ),
    },
    [month],
  );

  if (!profile) return null;
  if (!data) return <Spinner />;
  if (!data.row) return null;
  const { row, sessions } = data;
  const editable = row.state === "logging";
  const dayGroup = dayDate ? sessions.filter((s) => s.date === dayDate) : [];

  const runAction = async (fn: () => Promise<void>) => {
    setBusyAction(true);
    setActionError(null);
    try {
      await fn();
      refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div>
      <LockedBanner state={row.state} />

      <MoneyHero
        label="RUNNING TOTAL · EGP"
        value={fmt(row.total)}
        stats={[
          { k: "SESSIONS", v: `${row.count} ${row.count === 1 ? "session" : "sessions"}` },
          { k: row.tierName ? row.tierName.toUpperCase() : "RATE", v: `${row.rate} / session` },
          { k: "STATE", v: row.state.toUpperCase() },
        ]}
      />

      {isHead(profile.role) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {row.state === "logging" && row.count > 0 && (
            <Button variant="secondary" disabled={busyAction} onClick={() => runAction(() => api.settle(profile.id, month))}>
              Settle my month
            </Button>
          )}
          {row.state === "settled" && (
            <Button variant="danger" disabled={busyAction} onClick={() => runAction(() => api.reopen(profile.id, month))}>
              Reopen
            </Button>
          )}
        </div>
      )}
      {actionError && (
        <div style={{ marginBottom: 14, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
          {actionError}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>DAYS LOGGED</span>
        <span style={{ marginLeft: "auto", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
          {new Set(sessions.map((s) => s.date)).size} {new Set(sessions.map((s) => s.date)).size === 1 ? "DAY" : "DAYS"}
        </span>
      </div>

      <DayList sessions={sessions} rate={row.rate} state={row.state} onOpenDay={(g) => setDayDate(g.date)} />

      <div style={{ padding: "22px 2px 0", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
        {editable
          ? "Logging stays editable until a head settles the month. Tap a day to adjust it."
          : `Read-only · ${row.state.toUpperCase()} — contact a head to change anything.`}
      </div>

      <DaySessionsSheet
        open={!!dayDate}
        onClose={() => setDayDate(null)}
        coachId={profile.id}
        month={month}
        date={dayDate ?? ""}
        sessions={dayGroup}
        rate={row.rate}
        editable={editable}
        onChanged={refetch}
      />
      <MonthSwitcherSheet open={monthSheet} onClose={() => setMonthSheet(false)} coachId={profile.id} month={month} onChange={setMonth} />
    </div>
  );
}

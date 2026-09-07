import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { fmt, monthShort } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { LockedBanner } from "../components/LockedBanner";
import { DayList } from "../components/DayList";
import { DaySessionsSheet } from "../components/DaySessionsSheet";
import { MonthSwitcherSheet } from "../components/MonthSwitcherSheet";
import { AddSessionSheet } from "../components/AddSessionSheet";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";

export function CoachDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [month, setMonth] = useState((location.state as { month?: string })?.month ?? MOCK.CURRENT_MONTH);
  const [monthSheet, setMonthSheet] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const coachId = id ?? "";

  const { data, loading, refetch } = useAsync(async () => {
    const [monthRes, sessionsRes] = await Promise.all([api.month(month), api.sessions(coachId, month)]);
    return { row: monthRes.rows.find((r) => r.coachId === coachId) ?? null, sessions: sessionsRes.sessions };
  }, [coachId, month]);

  useSetHeader(
    {
      kicker: monthShort(month),
      title: data?.row?.name ?? "Coach",
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
    [month, data?.row?.name],
  );

  if (loading || !data || !data.row) return null;
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
      <button
        onClick={() => navigate("/coaches")}
        style={{ display: "flex", alignItems: "center", gap: 4, border: 0, background: "none", cursor: "pointer", color: "var(--ink-muted)", font: "600 13px var(--font-body)", padding: "0 0 14px" }}
      >
        <Icon name="chevron-left" size={16} /> Coaches
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Avatar name={row.name} size={44} />
        <div>
          <div style={{ font: "800 22px var(--font-body)", letterSpacing: "-.01em" }}>{row.name}</div>
          <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{row.tierName ?? "No tier"} · {row.email}</div>
        </div>
      </div>

      <LockedBanner state={row.state} />

      <MoneyHero
        label="MONTH TOTAL · EGP"
        value={fmt(row.total)}
        stats={[
          { k: "SESSIONS", v: `${row.count} ${row.count === 1 ? "session" : "sessions"}` },
          { k: row.tierName ? row.tierName.toUpperCase() : "RATE", v: `${row.rate} / session` },
          { k: "STATE", v: row.state.toUpperCase() },
        ]}
      />

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        {editable && (
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            + Add session on their behalf
          </Button>
        )}
        {row.state === "logging" && row.count > 0 && (
          <Button disabled={busyAction} onClick={() => runAction(() => api.settle(coachId, month))}>
            Settle month
          </Button>
        )}
        {row.state === "settled" && (
          <Button variant="danger" disabled={busyAction} onClick={() => runAction(() => api.reopen(coachId, month))}>
            Reopen
          </Button>
        )}
      </div>
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

      <DaySessionsSheet
        open={!!dayDate}
        onClose={() => setDayDate(null)}
        coachId={coachId}
        month={month}
        date={dayDate ?? ""}
        sessions={dayGroup}
        rate={row.rate}
        editable={editable}
        onChanged={refetch}
      />
      <AddSessionSheet open={addOpen} onClose={() => setAddOpen(false)} coachId={coachId} coachName={row.name} month={month} rate={row.rate} onSaved={refetch} />
      <MonthSwitcherSheet open={monthSheet} onClose={() => setMonthSheet(false)} coachId={coachId} month={month} onChange={setMonth} />
    </div>
  );
}

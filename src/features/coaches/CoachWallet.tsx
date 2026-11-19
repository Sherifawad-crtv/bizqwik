import { useState } from "react";
import { useAuth } from "../../shared/auth";
import { useOwnMonth } from "../../shared/ownMonth";
import { useAsync } from "../../shared/api/useAsync";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { api } from "../../shared/api/backend";
import { isHead, type Session } from "../../shared/types";
import { fmt } from "../../shared/format";
import { HomeAvatar } from "../../shared/components/HomeAvatar";
import { MoneyHero } from "../../design-system/components/MoneyHero";
import { LockedBanner } from "./LockedBanner";
import { DayList } from "../../shared/components/DayList";
import { DaySessionsSheet } from "../../shared/components/DaySessionsSheet";
import { AddSessionSheet } from "../../shared/components/AddSessionSheet";
import { Button } from "../../design-system/components/Button";
import { ScanFlow } from "../../shared/components/ScanFlow";
import { Spinner } from "../../design-system/components/Spinner";
import { Num } from "../../design-system/components/Num";

export function CoachWallet() {
  const { profile } = useAuth();
  const { month } = useOwnMonth();
  const isMobile = useIsMobile();
  const [addOpen, setAddOpen] = useState(false);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, mutate } = useAsync(async () => {
    if (!profile) return null;
    const [monthRes, sessionsRes] = await Promise.all([api.month(month), api.sessions(profile.id, month)]);
    return { row: monthRes.rows.find((r) => r.coachId === profile.id) ?? null, sessions: sessionsRes.sessions };
  }, [profile?.id, month]);

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
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyAction(false);
    }
  };

  const handleOptimisticAdd = (addedDate: string, qty: number) => {
    mutate((prev) => {
      if (!prev || !prev.row) return prev;
      const now = Date.now();
      const newSessions: Session[] = Array.from({ length: qty }, (_, i) => ({
        id: `optimistic-${now}-${i}`,
        coachId: profile.id,
        month,
        date: addedDate,
        createdBy: profile.id,
      }));
      const addedAmount = qty * prev.row.rate;
      return {
        row: { ...prev.row, count: prev.row.count + qty, groupTotal: prev.row.groupTotal + addedAmount, total: prev.row.total + addedAmount },
        sessions: [...prev.sessions, ...newSessions],
      };
    });
  };

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

      <LockedBanner state={row.state} />

      <MoneyHero
        label="RUNNING TOTAL · EGP"
        value={<Num value={row.total} />}
        stats={[
          { k: "SESSIONS", v: `${row.count} ${row.count === 1 ? "session" : "sessions"}` },
          { k: "GROUP", v: `${fmt(row.groupTotal)} EGP` },
          { k: "PRIVATE", v: `${fmt(row.privateTotal)} EGP` },
          { k: "STATE", v: row.state.toUpperCase() },
        ]}
      />

      {((editable && !isMobile) || isHead(profile.role)) && (
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          {isHead(profile.role) && row.state === "logging" && row.count > 0 && (
            <Button variant="secondary" disabled={busyAction} onClick={() => runAction(() => api.settle(profile.id, month))}>
              Settle my month
            </Button>
          )}
          {isHead(profile.role) && row.state === "settled" && (
            <Button variant="danger" disabled={busyAction} onClick={() => runAction(() => api.reopen(profile.id, month))}>
              Reopen
            </Button>
          )}
          {editable && !isMobile && isHead(profile.role) && (
            <Button onClick={() => setAddOpen(true)}>+ Add session</Button>
          )}
          {editable && !isMobile && (
            <ScanFlow trigger={(open, busy) => <Button variant={isHead(profile.role) ? "secondary" : "primary"} disabled={busy} onClick={open}>Scan QR</Button>} />
          )}
        </div>
      )}
      {actionError && (
        <div className="bq-rise" style={{ marginBottom: 14, font: "600 var(--text-footnote-size)/1.5 var(--font-family-body)", color: "var(--color-text-status-danger-default)", background: "var(--color-bg-fill-status-danger-default)", borderRadius: "var(--radius-item)", padding: "10px 14px" }}>
          {actionError}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span className="bq-label">DAYS LOGGED</span>
        <span style={{ marginLeft: "auto", font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>
          {new Set(sessions.map((s) => s.date)).size} {new Set(sessions.map((s) => s.date)).size === 1 ? "DAY" : "DAYS"}
        </span>
      </div>

      <DayList
        sessions={sessions}
        rate={row.rate}
        state={row.state}
        onOpenDay={(g) => setDayDate(g.date)}
        emptyHint={editable ? "Tap + and scan the coaches' room QR when you arrive to log your first session." : "No sessions were logged this month."}
      />

      <div style={{ padding: "22px 2px 0", font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>
        {editable
          ? profile.role === "coach"
            ? "Log attendance by scanning the coaches' room QR. Tap a day to remove a mistake."
            : "Logging stays editable until a head settles the month. Tap a day to adjust it."
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
        scanOnly={profile.role === "coach"}
        onOptimisticAdd={(d) => handleOptimisticAdd(d, 1)}
      />
      <AddSessionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        coachId={profile.id}
        month={month}
        rate={row.rate}
        onOptimisticAdd={handleOptimisticAdd}
      />
    </div>
  );
}

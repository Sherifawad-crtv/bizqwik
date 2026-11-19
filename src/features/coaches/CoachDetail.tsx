import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSetHeader } from "../../shared/screen/header";
import { useFloatingActions, useBackAction } from "../../shared/screen/floatingActions";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { useAsync } from "../../shared/api/useAsync";
import { api, MOCK } from "../../shared/api/backend";
import { fmt, monthShort } from "../../shared/format";
import { stateLabel } from "./payables";
import type { Session } from "../../shared/types";
import { MoneyHero } from "../../design-system/components/MoneyHero";
import { LockedBanner } from "./LockedBanner";
import { DayList } from "../../shared/components/DayList";
import { DaySessionsSheet } from "../../shared/components/DaySessionsSheet";
import { AddSessionSheet } from "../../shared/components/AddSessionSheet";
import { Avatar } from "../../design-system/components/Avatar";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Spinner } from "../../design-system/components/Spinner";
import { Num } from "../../design-system/components/Num";
import "./CoachDetail.css";

export function CoachDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const nav = (location.state as { month?: string; from?: "history" | "team" } | null) ?? {};
  const month = nav.month ?? MOCK.CURRENT_MONTH;
  const from = nav.from === "history" ? "history" : "team";
  // Back goes to wherever you came from, as you left it.
  const goBack = () => (location.key !== "default" ? navigate(-1) : navigate(from === "history" ? `/history?month=${month}` : "/coaches"));
  const [addOpen, setAddOpen] = useState(false);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const coachId = id ?? "";

  const { data, mutate } = useAsync(async () => {
    const [monthRes, sessionsRes] = await Promise.all([api.month(month), api.sessions(coachId, month)]);
    return { row: monthRes.rows.find((r) => r.coachId === coachId) ?? null, sessions: sessionsRes.sessions };
  }, [coachId, month]);

  useSetHeader({ kicker: monthShort(month), title: "Coach" }, [month]);
  useBackAction(goBack);

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


  // On a phone this page has no tab bar: its main actions float at the bottom instead.
  const isMobile = useIsMobile();
  const r = data?.row ?? null;
  const floating = isMobile && r ? (
    <>
      {r.state === "logging" && (
        <Button size="lg" variant="secondary" className="bq-grow" onClick={() => setAddOpen(true)}>
          + Add on behalf
        </Button>
      )}
      {r.state === "logging" && r.count > 0 && (
        <Button size="lg" className="bq-grow" disabled={busyAction} onClick={() => runAction(() => api.settle(coachId, month))}>
          Settle month
        </Button>
      )}
      {r.state === "settled" && (
        <Button size="lg" variant="danger" className="bq-grow" disabled={busyAction} onClick={() => runAction(() => api.reopen(coachId, month))}>
          Reopen
        </Button>
      )}
    </>
  ) : null;
  useFloatingActions(floating);

  if (!data) return <Spinner />;
  if (!data.row) return null;
  const { row, sessions } = data;
  const editable = row.state === "logging";
  const dayGroup = dayDate ? sessions.filter((s) => s.date === dayDate) : [];

  const handleOptimisticAdd = (addedDate: string, qty: number) => {
    mutate((prev) => {
      if (!prev || !prev.row) return prev ?? { row: null, sessions: [] };
      const now = Date.now();
      const newSessions: Session[] = Array.from({ length: qty }, (_, i) => ({
        id: `optimistic-${now}-${i}`,
        coachId,
        month,
        date: addedDate,
        createdBy: coachId,
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
      {!isMobile && (
      <button className="bq-coaches-coach-detail-btn"
        onClick={goBack}
      >
        <Icon name="chevron-left" size={16} /> {from === "history" ? "History" : "Team"}
      </button>
      )}

      <div className="bq-flex bq-items-center bq-gap-3 bq-mb-4">
        <Avatar name={row.name} size={44} src={row.avatarUrl} />
        <div>
          <div className="bq-coaches-coach-detail-title">{row.name}</div>
          <div className="bq-meta">{row.tierName ?? "No tier"} · {row.email}</div>
        </div>
      </div>

      <LockedBanner state={row.state} />

      <MoneyHero
        label="MONTH TOTAL · EGP"
        value={<Num value={row.total} />}
        stats={[
          { k: "SESSIONS", v: `${row.count} ${row.count === 1 ? "session" : "sessions"}` },
          { k: "GROUP", v: `${fmt(row.groupTotal)} EGP` },
          { k: "PRIVATE", v: `${fmt(row.privateTotal)} EGP` },
          { k: "STATE", v: stateLabel(row) },
        ]}
      />

      {!isMobile && (
      <div className="bq-flex bq-gap-2 bq-mb-4 bq-wrap">
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
      )}
      {actionError && (
        <div className="bq-rise bq-coaches-coach-detail-text">
          {actionError}
        </div>
      )}

      <div className="bq-coaches-coach-detail-row">
        <span className="bq-label">DAYS LOGGED</span>
        <span className="bq-coaches-coach-detail-meta">
          {new Set(sessions.map((s) => s.date)).size} {new Set(sessions.map((s) => s.date)).size === 1 ? "DAY" : "DAYS"}
        </span>
      </div>

      <DayList sessions={sessions} rate={row.rate} state={row.state} onOpenDay={(g) => setDayDate(g.date)} emptyHint="This coach hasn't logged a session this month. Sessions they scan in show up here, and you can add one by hand." />

      <DaySessionsSheet
        open={!!dayDate}
        onClose={() => setDayDate(null)}
        coachId={coachId}
        month={month}
        date={dayDate ?? ""}
        sessions={dayGroup}
        rate={row.rate}
        editable={editable}
        onOptimisticAdd={(d) => handleOptimisticAdd(d, 1)}
      />
      <AddSessionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        coachId={coachId}
        coachName={row.name}
        month={month}
        rate={row.rate}
        onOptimisticAdd={handleOptimisticAdd}
      />
    </div>
  );
}

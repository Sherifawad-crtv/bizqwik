import { useState } from "react";
import { Sheet } from "../../../design-system/components/Sheet";
import { Button } from "../../../design-system/components/Button";
import { DateField } from "../../../design-system/components/DateField";
import { ConfirmSheet } from "../../../design-system/components/ConfirmSheet";
import { useLatch } from "../../../shared/hooks/useLatch";
import { daySessionCalls } from "./hooks/useCoaches";
import type { Session } from "../../../shared/types";
import { dateLabelFull, daysInMonth, egp, isoDate, sessionStamp } from "../../../shared/format";
import { IconButton } from "../../../design-system/components/IconButton";
import "./DaySessionsSheet.css";

interface DaySessionsSheetProps {
  open: boolean;
  onClose: () => void;
  coachId: string;
  month: string;
  date: string;
  sessions: Session[];
  rate: number;
  editable: boolean;
  /** Called synchronously right when "add another" is tapped, before the
   * network call — lets the caller show the new session instantly. */
  onOptimisticAdd?: (date: string) => void;
  /** A coach's own day: sessions come only from scanning the coaches' QR, so
   * no adding or re-dating here — only removing a mistaken one. */
  scanOnly?: boolean;
}

export function DaySessionsSheet({ open, onClose, coachId, month, date, sessions, rate, editable, onOptimisticAdd, scanOnly = false }: DaySessionsSheetProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const min = isoDate(month, 1);
  const max = isoDate(month, daysInMonth(month));

  // The parent clears its "selected day" state as soon as onClose fires, so
  // date/sessions go blank while this sheet is still playing its close
  // animation — latch them so the content doesn't glitch to "undefined" /
  // empty mid-exit.
  const shown = useLatch(date ? { date, sessions } : null);

  const move = async (id: string, newDate: string) => {
    setBusyId(id);
    setError(null);
    try {
      await daySessionCalls.move(id, coachId, month, newDate);
      setMovingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't move that session.");
    } finally {
      setBusyId(null);
    }
  };

  const addAnother = async () => {
    setError(null);
    onOptimisticAdd?.(date);
    try {
      await daySessionCalls.add(coachId, month, date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add a session.");
    }
  };

  // computed against the raw prop (not `shown`) so it stays correct even on
  // the render where `shown` hasn't caught up yet; useLatch itself must run
  // unconditionally on every render, before any early return below.
  const removingIndex = sessions.findIndex((s) => s.id === removingId);
  const shownRemovingIndex = useLatch(removingId ? removingIndex : null);

  if (!shown) return null;
  const { sessions: shownSessions } = shown;

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div className="bq-label">{editable ? "EDIT DAY" : "DAY"}</div>
        <div className="bq-stat-lg bq-day-sessions-sheet-spacing">{dateLabelFull(shown.date)}</div>
        <div className="bq-day-sessions-sheet-meta">
          {shownSessions.length} {shownSessions.length === 1 ? "session" : "sessions"} · {egp(shownSessions.length * rate)}
        </div>

        <div className="bq-flex bq-col bq-gap-2">
          {shownSessions.map((s, i) => (
            <div className="bq-day-sessions-sheet-box" key={s.id}>
              {movingId === s.id ? (
                <DateField value={s.date} min={min} max={max} onChange={(d) => move(s.id, d)} />
              ) : (
                <div className="bq-flex bq-items-center bq-gap-2">
                  <span className="bq-day-sessions-sheet-text">Session {i + 1}</span>
                  <span className="bq-day-sessions-sheet-label">{s.source === "qr" ? "QR" : "MANUAL"}</span>
                  {(() => {
                    const st = sessionStamp(s);
                    return st ? <span className="bq-day-sessions-sheet-meta-2" data-testid="session-time">{st.text}</span> : null;
                  })()}
                  {editable && (
                    <>
                      {!scanOnly && (
                      <IconButton className="bq-ml-auto" icon="pencil" label="Change date" disabled={busyId === s.id} onClick={() => setMovingId(s.id)} />
                      )}
                      <IconButton icon="trash" label="Remove session" tone="danger" disabled={busyId === s.id} style={{ marginLeft: scanOnly ? "auto" : undefined }} onClick={() => setRemovingId(s.id)} />
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div  className="bq-error bq-error--spaced bq-rise">
            {error}
          </div>
        )}

        {editable && !scanOnly && (
          <Button className="bq-mt-4" variant="secondary" fullWidth onClick={addAnother}>
            + Add another session this date
          </Button>
        )}
        <Button className="bq-mt-2" variant="quiet" fullWidth onClick={onClose}>
          Close
        </Button>
      </Sheet>

      <ConfirmSheet
        open={!!removingId}
        onClose={() => setRemovingId(null)}
        kicker="REMOVE SESSION"
        title={`Remove session ${(shownRemovingIndex ?? -1) + 1}?`}
        sub="This can't be undone."
        confirmLabel="Remove session"
        danger
        onConfirm={async () => {
          if (!removingId) return;
          await daySessionCalls.remove(removingId, coachId, month);
        }}
      />
    </>
  );
}

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { DateField } from "./DateField";
import { ConfirmSheet } from "./ConfirmSheet";
import { useLatch } from "../lib/useLatch";
import { api } from "../lib/backend";
import type { Session } from "../lib/types";
import { dateLabelFull, daysInMonth, egp, isoDate } from "../lib/format";

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
}

export function DaySessionsSheet({ open, onClose, coachId, month, date, sessions, rate, editable, onOptimisticAdd }: DaySessionsSheetProps) {
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
      await api.editSession(id, coachId, month, newDate);
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
      await api.addSession(coachId, month, date);
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
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{editable ? "EDIT DAY" : "DAY"}</div>
        <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 4px" }}>{dateLabelFull(shown.date)}</div>
        <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginBottom: 16 }}>
          {shownSessions.length} {shownSessions.length === 1 ? "session" : "sessions"} · {egp(shownSessions.length * rate)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {shownSessions.map((s, i) => (
            <div key={s.id} data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 14px" }}>
              {movingId === s.id ? (
                <DateField value={s.date} min={min} max={max} onChange={(d) => move(s.id, d)} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ font: "600 15px var(--font-body)", color: "var(--ink)" }}>Session {i + 1}</span>
                  {editable && (
                    <>
                      <button
                        aria-label="Change date"
                        onClick={() => setMovingId(s.id)}
                        disabled={busyId === s.id}
                        style={{ marginLeft: "auto", width: 34, height: 34, borderRadius: 999, border: 0, background: "var(--primary-tint)", color: "var(--primary-pressed)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Icon name="pencil" size={15} />
                      </button>
                      <button
                        aria-label="Remove session"
                        onClick={() => setRemovingId(s.id)}
                        disabled={busyId === s.id}
                        style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: "var(--danger-bg)", color: "var(--danger-fg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
            {error}
          </div>
        )}

        {editable && (
          <Button variant="secondary" fullWidth style={{ marginTop: 14 }} onClick={addAnother}>
            + Add another session this date
          </Button>
        )}
        <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose}>
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
          await api.removeSession(removingId, coachId, month);
        }}
      />
    </>
  );
}

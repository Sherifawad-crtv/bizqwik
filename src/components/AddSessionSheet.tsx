import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { DateField } from "./DateField";
import { Stepper } from "./Stepper";
import { Button } from "./Button";
import { api } from "../lib/backend";
import { daysInMonth, egp, isoDate, monthLabel, todayIso } from "../lib/format";

interface AddSessionSheetProps {
  open: boolean;
  onClose: () => void;
  coachId: string;
  coachName?: string;
  month: string;
  rate: number;
  onSaved: () => void;
}

export function AddSessionSheet({ open, onClose, coachId, coachName, month, rate, onSaved }: AddSessionSheetProps) {
  const min = isoDate(month, 1);
  const max = isoDate(month, daysInMonth(month));
  const defaultDate = () => {
    const today = todayIso();
    return today >= min && today <= max ? today : min;
  };

  const [date, setDate] = useState(defaultDate);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDate(defaultDate());
      setQty(1);
      setError(null);
      setSavedCount(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, month]);

  if (!open) return null;

  const confirm = async () => {
    setSaving(true);
    setError(null);
    let done = 0;
    try {
      for (let i = 0; i < qty; i++) {
        await api.addSession(coachId, month, date);
        done += 1;
      }
      onSaved();
      onClose();
    } catch (err) {
      setSavedCount(done);
      setError(
        `${err instanceof Error ? err.message : "Something went wrong."} Saved ${done} of ${qty}${
          done < qty ? " — try again for the rest." : "."
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>NEW ENTRY</div>
      <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 4px" }}>Log a session</div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginBottom: 16 }}>
        {coachName ? `Adds to ${coachName}'s ${monthLabel(month)} total.` : `Adds to your ${monthLabel(month)} total.`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <DateField value={date} min={min} max={max} onChange={setDate} />
        <Stepper value={qty} onChange={setQty} />
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 6px 0" }}>
          <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>ADDS</span>
          <span className="tabular" style={{ marginLeft: "auto", font: "800 30px var(--font-body)", letterSpacing: "-.02em", color: "var(--primary)" }}>
            +{qty * rate}
          </span>
          <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--primary)" }}>EGP</span>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
          {error}
        </div>
      )}

      <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={confirm} disabled={saving}>
        {saving ? "Saving…" : `Add ${qty} ${qty === 1 ? "session" : "sessions"} · ${egp(qty * rate)}`}
      </Button>
      <Button fullWidth variant="secondary" style={{ marginTop: 8 }} onClick={onClose} disabled={saving}>
        {savedCount !== null && savedCount > 0 ? "Close" : "Cancel"}
      </Button>
    </Sheet>
  );
}

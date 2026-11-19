import { useEffect, useState } from "react";
import { Sheet } from "../../design-system/components/Sheet";
import { DateField } from "../../design-system/components/DateField";
import { Stepper } from "../../design-system/components/Stepper";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { SheetSuccessIcon } from "../../design-system/components/SheetSuccessIcon";
import { useSheetSuccess } from "../../design-system/components/useSheetSuccess";
import { api } from "../api/backend";
import { daysInMonth, egp, isoDate, monthLabel, todayIso } from "../format";

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

interface AddSessionSheetProps {
  open: boolean;
  onClose: () => void;
  coachId: string;
  coachName?: string;
  month: string;
  rate: number;
  /** Called synchronously the moment the user confirms, before the network
   * calls — lets the caller show the new session(s) instantly instead of
   * waiting on a round-trip. The following refetch reconciles it for real. */
  onOptimisticAdd?: (date: string, qty: number) => void;
  /** Set after the coach scans the coaches'-room QR: the date is locked to
   * the day of the scan and the scan token proves they're on site. */
  scan?: { token: string; date: string; month: string };
}

export function AddSessionSheet({ open, onClose, coachId, coachName, month: monthProp, rate, onOptimisticAdd, scan }: AddSessionSheetProps) {
  const month = scan?.month ?? monthProp;
  const min = isoDate(month, 1);
  const max = isoDate(month, daysInMonth(month));
  const defaultDate = () => {
    if (scan) return scan.date;
    const today = todayIso();
    return today >= min && today <= max ? today : min;
  };

  const [date, setDate] = useState(defaultDate);
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (open) {
      setDate(defaultDate());
      setQty(1);
      setError(null);
      setSavedCount(null);
    }
    // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, month, scan?.date]);

  const confirm = async () => {
    setSaving(true);
    setError(null);
    let done = 0;
    onOptimisticAdd?.(date, qty);
    try {
      for (let i = 0; i < qty; i++) {
        await api.addSession(coachId, month, date, scan?.token);
        done += 1;
      }
      showSuccess();
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
      {confirmed ? (
        <SheetSuccessIcon label={`Added ${qty} ${qty === 1 ? "session" : "sessions"} · ${egp(qty * rate)}`} iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">NEW ENTRY</div>
          <div className="bq-stat-lg" style={{ margin: "4px 0 4px" }}>Log a session</div>
          <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", marginBottom: 16 }}>
            {coachName ? `Adds to ${coachName}'s ${monthLabel(month)} total.` : `Adds to your ${monthLabel(month)} total.`}
          </div>

          <div className="bq-stack">
            {scan ? (
              <div data-testid="scan-date" style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--color-bg-surface-secondary-default)", border: "1px solid var(--color-border-primary-default)", borderRadius: "var(--radius-item)", padding: "14px 16px" }}>
                <Icon name="check" size={18} />
                <span style={{ font: "700 var(--text-body-size) var(--font-family-body)" }}>Today · {shortDay(scan.date)}</span>
                <span style={{ marginLeft: "auto", font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)" }}>QR VERIFIED</span>
              </div>
            ) : (
              <DateField value={date} min={min} max={max} onChange={setDate} />
            )}
            <Stepper value={qty} onChange={setQty} />
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 6px 0" }}>
              <span className="bq-label">ADDS</span>
              <span className="tabular bq-rise" style={{ marginLeft: "auto", font: "800 var(--text-large-title-size) var(--font-family-body)", letterSpacing: "-.02em", color: "var(--color-bg-fill-primary-default)" }}>
                +{qty * rate}
              </span>
              <span style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-bg-fill-primary-default)" }}>EGP</span>
            </div>
          </div>

          {error && (
            <div  className="bq-error bq-error--spaced">
              {error}
            </div>
          )}

          <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={confirm} disabled={saving}>
            {saving ? "Saving…" : `Add ${qty} ${qty === 1 ? "session" : "sessions"} · ${egp(qty * rate)}`}
          </Button>
          <Button fullWidth variant="secondary" style={{ marginTop: 8 }} onClick={onClose} disabled={saving}>
            {savedCount !== null && savedCount > 0 ? "Close" : "Cancel"}
          </Button>
        </>
      )}
    </Sheet>
  );
}

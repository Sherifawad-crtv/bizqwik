import type { State } from "../../shared/types";
import "./LockedBanner.css";

const COPY: Partial<Record<State, { label: string; text: string; fg: string; bg: string }>> = {
  settled: { label: "SETTLED", text: "Settled — contact a head to change anything.", fg: "var(--color-text-status-settled-default)", bg: "var(--color-bg-fill-status-settled-default)" },
  paid: { label: "PAID", text: "Paid and locked. Kept here for your records.", fg: "var(--color-text-status-paid-default)", bg: "var(--color-bg-fill-status-paid-default)" },
};

export function LockedBanner({ state }: { state: State }) {
  const copy = COPY[state];
  if (!copy) return null;
  return (
    <div className="bq-coaches-locked-banner-row" style={{ background: copy.bg }}>
      <i className="bq-coaches-locked-banner-box" style={{ background: copy.fg }} />
      <div>
        <div className="bq-coaches-locked-banner-label" style={{ color: copy.fg }}>{copy.label}</div>
        <div className="bq-coaches-locked-banner-text">{copy.text}</div>
      </div>
    </div>
  );
}

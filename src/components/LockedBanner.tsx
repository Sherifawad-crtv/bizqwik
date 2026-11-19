import type { State } from "../lib/types";

const COPY: Partial<Record<State, { label: string; text: string; fg: string; bg: string }>> = {
  settled: { label: "SETTLED", text: "Settled — contact a head to change anything.", fg: "var(--color-text-status-settled-default)", bg: "var(--color-bg-fill-status-settled-default)" },
  paid: { label: "PAID", text: "Paid and locked. Kept here for your records.", fg: "var(--color-text-status-paid-default)", bg: "var(--color-bg-fill-status-paid-default)" },
};

export function LockedBanner({ state }: { state: State }) {
  const copy = COPY[state];
  if (!copy) return null;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: copy.bg, borderRadius: "var(--radius-item)", padding: "14px 16px", marginBottom: 14 }}>
      <i style={{ width: 8, height: 8, borderRadius: 999, flex: "none", marginTop: 6, background: copy.fg, display: "block" }} />
      <div>
        <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: copy.fg }}>{copy.label}</div>
        <div style={{ font: "500 var(--text-callout-size)/1.35 var(--font-family-body)", color: "var(--color-text-primary-default)" }}>{copy.text}</div>
      </div>
    </div>
  );
}

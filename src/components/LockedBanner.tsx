import type { State } from "../lib/types";

const COPY: Partial<Record<State, { label: string; text: string; fg: string; bg: string }>> = {
  settled: { label: "SETTLED", text: "Settled — contact a head to change anything.", fg: "var(--settled-fg)", bg: "var(--settled-bg)" },
  paid: { label: "PAID", text: "Paid and locked. Kept here for your records.", fg: "var(--paid-fg)", bg: "var(--paid-bg)" },
};

export function LockedBanner({ state }: { state: State }) {
  const copy = COPY[state];
  if (!copy) return null;
  return (
    <div data-sq style={{ display: "flex", gap: 12, alignItems: "flex-start", background: copy.bg, borderRadius: "var(--r-tile)", padding: "14px 16px", marginBottom: 14 }}>
      <i style={{ width: 8, height: 8, borderRadius: 999, flex: "none", marginTop: 6, background: copy.fg, display: "block" }} />
      <div>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: copy.fg }}>{copy.label}</div>
        <div style={{ font: "500 16px/1.35 var(--font-body)", color: "var(--ink)" }}>{copy.text}</div>
      </div>
    </div>
  );
}

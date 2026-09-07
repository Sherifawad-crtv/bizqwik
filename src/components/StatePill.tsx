import type { State } from "../lib/types";
import { STATE_LABELS } from "../lib/types";

const STYLES: Record<State, { fg: string; bg: string }> = {
  logging: { fg: "var(--logging-fg)", bg: "var(--logging-bg)" },
  settled: { fg: "var(--settled-fg)", bg: "var(--settled-bg)" },
  paid: { fg: "var(--paid-fg)", bg: "var(--paid-bg)" },
};

export function StatePill({ state, label }: { state: State; label?: string }) {
  const s = STYLES[state];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        font: "700 11px var(--font-mono)",
        letterSpacing: ".08em",
        whiteSpace: "nowrap",
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: 999, background: s.fg, display: "block", flex: "none" }} />
      {(label ?? STATE_LABELS[state]).toUpperCase()}
    </span>
  );
}

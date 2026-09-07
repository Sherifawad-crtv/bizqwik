import { Icon } from "./Icon";

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

export function Stepper({ value, min = 1, max = 12, onChange }: StepperProps) {
  return (
    <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px" }}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>SESSIONS THAT DAY</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
        <button
          type="button"
          aria-label="Fewer"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            color: "var(--ink)",
            cursor: value <= min ? "default" : "pointer",
            opacity: value <= min ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="minus" size={18} strokeWidth={2.4} />
        </button>
        <span className="tabular" style={{ flex: 1, textAlign: "center", font: "800 44px var(--font-body)", letterSpacing: "-.03em" }}>
          {value}
        </span>
        <button
          type="button"
          aria-label="More"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            border: 0,
            background: "var(--primary-tint)",
            color: "var(--primary-pressed)",
            cursor: value >= max ? "default" : "pointer",
            opacity: value >= max ? 0.4 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="plus" size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

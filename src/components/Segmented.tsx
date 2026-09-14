export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, background: "var(--sunken)", borderRadius: 999, padding: 4, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              border: 0,
              cursor: "pointer",
              flex: "none",
              padding: "9px 14px",
              borderRadius: 999,
              background: on ? "var(--surface)" : "transparent",
              color: on ? "var(--ink)" : "var(--ink-muted)",
              font: "700 12px var(--font-mono)",
              letterSpacing: ".06em",
              whiteSpace: "nowrap",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

import { startTransition, useState } from "react";
import { useSlidingThumb } from "./useSlidingThumb";


export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  // The pill moves the moment you tap. The screen behind may be heavy to
  // redraw, so that update runs after, as a transition, instead of holding the
  // pill back.
  const [shown, setShown] = useState(value);
  // Follow the real value when it changes from outside (derived while rendering: no extra pass).
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setShown(value);
  }
  const { ref, thumb } = useSlidingThumb(shown);
  const pick = (v: T) => {
    setShown(v);
    startTransition(() => onChange(v));
  };
  return (
    <div ref={ref} style={{ position: "relative", isolation: "isolate", display: "flex", gap: 6, background: "var(--sunken)", borderRadius: 999, padding: 4, width: "fit-content", maxWidth: "100%", overflowX: "auto" }}>
      {thumb}
      {options.map((o) => {
        const on = o.value === shown;
        return (
          <button
            key={o.value}
            className="bq-hit bq-still"
            data-thumb-on={on ? "" : undefined}
            onClick={() => pick(o.value)}
            aria-pressed={on}
            style={{
              border: 0,
              cursor: "pointer",
              flex: "none",
              position: "relative",
              padding: "9px 14px",
              borderRadius: 999,
              background: "transparent",
              color: on ? "var(--ink)" : "var(--ink-muted)",
              transition: "color .2s ease",
              font: "700 var(--fs-small) var(--font-mono)",
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

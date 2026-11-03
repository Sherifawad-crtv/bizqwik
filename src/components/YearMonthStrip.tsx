import { startTransition, useEffect, useRef, useState } from "react";
import { useSlidingThumb } from "./Segmented";
import { monthAbbr } from "../lib/format";
import { MOCK } from "../lib/backend";

export function YearMonthStrip({ months, value, onChange }: { months: string[]; value: string; onChange: (m: string) => void }) {
  const [shown, setShown] = useState(value);
  useEffect(() => setShown(value), [value]);
  const { ref: trackRef, thumb } = useSlidingThumb(shown);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={trackRef}
      style={{
        position: "relative",
        isolation: "isolate",
        display: "flex",
        gap: 6,
        background: "var(--sunken)",
        borderRadius: 999,
        padding: 4,
        width: "fit-content",
        maxWidth: "100%",
        overflowX: "auto",
        marginBottom: 18,
      }}
    >
      {thumb}
      {months.map((m) => {
        const on = m === shown;
        const isNow = m === MOCK.CURRENT_MONTH;
        const future = m > MOCK.CURRENT_MONTH;
        return (
          <button
            key={m}
            ref={on ? selectedRef : undefined}
            data-thumb-on={on ? "" : undefined}
            data-nopress
            onClick={() => {
              if (future) return;
              setShown(m);
              startTransition(() => onChange(m));
            }}
            disabled={future}
            style={{
              border: 0,
              cursor: future ? "default" : "pointer",
              flex: "none",
              position: "relative",
              padding: "9px 14px",
              borderRadius: 999,
              background: "transparent",
              transition: "color .2s ease",
              color: future ? "var(--ink-faint)" : on ? "var(--ink)" : "var(--ink-muted)",
              opacity: future ? 0.45 : 1,
              font: "700 12px var(--font-mono)",
              letterSpacing: ".06em",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {monthAbbr(m)}
            {isNow && (
              <i style={{ width: 4, height: 4, borderRadius: 999, background: on ? "var(--primary)" : "var(--ink-faint)", display: "block" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

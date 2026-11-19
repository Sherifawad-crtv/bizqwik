import { useState } from "react";
import { Sheet } from "./Sheet";
import { dateLabel, daysInMonth, isoDate, monthLabel, weekdayOf } from "../lib/format";

interface DateFieldProps {
  value: string; // ISO yyyy-mm-dd
  min?: string;
  max?: string;
  onChange: (iso: string) => void;
}

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export function DateField({ value, min, max, onChange }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const month = value.slice(0, 7);
  const total = daysInMonth(month);
  const leading = weekdayOf(month, 1);

  const days: (number | null)[] = [...Array(leading).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          position: "relative",
          width: "100%",
          textAlign: "left",
          background: "var(--color-bg-surface-secondary-default)",
          border: "1px solid var(--color-border-primary-default)",
          borderRadius: "var(--radius-item)",
          padding: "12px 16px",
          cursor: "pointer",
        }}
      >
        <div className="bq-label">DATE</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ font: "600 var(--text-callout-size) var(--font-family-body)", color: "var(--color-text-primary-default)" }}>{dateLabel(value)}</span>
          <span style={{ marginLeft: "auto", font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>TAP TO CHANGE</span>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="bq-label">DATE</div>
        <div className="bq-title">{monthLabel(month)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 4 }}>
          {DOW.map((d, i) => (
            <div key={i} style={{ textAlign: "center", font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".04em", color: "var(--color-text-tertiary-default)", padding: "4px 0" }}>
              {d}
            </div>
          ))}
          {days.map((day, i) => {
            if (day === null) return <div key={`b${i}`} />;
            const iso = isoDate(month, day);
            const disabled = (min && iso < min) || (max && iso > max);
            const on = iso === value;
            return (
              <button
                key={iso}
                disabled={!!disabled}
                onClick={() => {
                  onChange(iso);
                  setOpen(false);
                }}
                style={{
                  aspectRatio: "1",
                  border: 0,
                  borderRadius: "var(--radius-item)",
                  background: on ? "var(--color-bg-fill-primary-default)" : "var(--color-bg-surface-secondary-default)",
                  color: disabled ? "var(--color-text-tertiary-default)" : on ? "var(--color-text-on-fill-default)" : "var(--color-text-primary-default)",
                  opacity: disabled ? 0.4 : 1,
                  font: "700 var(--text-body-size) var(--font-family-body)",
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {day}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

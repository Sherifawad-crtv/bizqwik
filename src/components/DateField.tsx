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
        data-sq
        onClick={() => setOpen(true)}
        style={{
          position: "relative",
          width: "100%",
          textAlign: "left",
          background: "var(--sunken)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-input)",
          padding: "12px 16px",
          cursor: "pointer",
        }}
      >
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>DATE</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ font: "600 16px var(--font-body)", color: "var(--ink)" }}>{dateLabel(value)}</span>
          <span style={{ marginLeft: "auto", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>TAP TO CHANGE</span>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>DATE</div>
        <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{monthLabel(month)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 4 }}>
          {DOW.map((d, i) => (
            <div key={i} style={{ textAlign: "center", font: "700 11px var(--font-mono)", letterSpacing: ".04em", color: "var(--ink-faint)", padding: "4px 0" }}>
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
                data-sq
                style={{
                  aspectRatio: "1",
                  border: 0,
                  borderRadius: "var(--r-input)",
                  background: on ? "var(--primary)" : "var(--sunken)",
                  color: disabled ? "var(--ink-faint)" : on ? "#fff" : "var(--ink)",
                  opacity: disabled ? 0.4 : 1,
                  font: "700 15px var(--font-body)",
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

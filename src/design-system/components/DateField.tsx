import { useState } from "react";
import { Sheet } from "./Sheet";
import { dateLabel, daysInMonth, isoDate, monthLabel, weekdayOf } from "../format";

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
      <div className="bq-date-field-box"
        onClick={() => setOpen(true)}
      >
        <div className="bq-label">DATE</div>
        <div className="bq-flex bq-items-baseline bq-gap-2">
          <span className="bq-date-field-text">{dateLabel(value)}</span>
          <span className="bq-date-field-meta">TAP TO CHANGE</span>
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="bq-label">DATE</div>
        <div className="bq-title">{monthLabel(month)}</div>
        <div className="bq-date-field-grid">
          {DOW.map((d, i) => (
            <div className="bq-date-field-label" key={i}>
              {d}
            </div>
          ))}
          {days.map((day, i) => {
            if (day === null) return <div key={`b${i}`} />;
            const iso = isoDate(month, day);
            const disabled = (min && iso < min) || (max && iso > max);
            const on = iso === value;
            return (
              <button className="bq-date-field-btn"
                key={iso}
                disabled={!!disabled}
                onClick={() => {
                  onChange(iso);
                  setOpen(false);
                }}
                style={{ background: on ? "var(--color-bg-fill-primary-default)" : "var(--color-bg-surface-secondary-default)", color: disabled ? "var(--color-text-tertiary-default)" : on ? "var(--color-text-on-fill-default)" : "var(--color-text-primary-default)", opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
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

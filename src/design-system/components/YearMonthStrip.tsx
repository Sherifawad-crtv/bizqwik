import { startTransition, useEffect, useRef, useState } from "react";
import { useSlidingThumb } from "./useSlidingThumb";
import { monthAbbr } from "../format";
import { QUICK_MS, tr } from "../motion/motion";

/** `currentMonth` ("2026-11") is marked as now; months after it show as future. */
export function YearMonthStrip({ months, value, onChange, currentMonth }: { months: string[]; value: string; onChange: (m: string) => void; currentMonth: string }) {
  const [shown, setShown] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setShown(value);
  }
  const { ref: trackRef, thumb } = useSlidingThumb(shown);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", inline: "center", behavior: "auto" });
    // Deliberate: Scroll to the selected month only when the selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bq-year-month-strip-row"
      ref={trackRef}
    >
      {thumb}
      {months.map((m) => {
        const on = m === shown;
        const isNow = m === currentMonth;
        const future = m > currentMonth;
        return (
          <button
            key={m}
            ref={on ? selectedRef : undefined}
            data-thumb-on={on ? "" : undefined}
            className="bq-still bq-year-month-strip-btn"
            onClick={() => {
              if (future) return;
              setShown(m);
              startTransition(() => onChange(m));
            }}
            disabled={future}
            style={{ cursor: future ? "default" : "pointer", transition: tr("color", QUICK_MS), color: future ? "var(--color-text-tertiary-default)" : on ? "var(--color-text-primary-default)" : "var(--color-text-secondary-default)", opacity: future ? 0.45 : 1 }}
          >
            {monthAbbr(m)}
            {isNow && (
              <i className="bq-year-month-strip-box" style={{ background: on ? "var(--color-bg-fill-primary-default)" : "var(--color-text-tertiary-default)" }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

import { startTransition, useState } from "react";
import { useSlidingThumb } from "./useSlidingThumb";
import { QUICK_MS, tr } from "../motion/motion";


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
  // Sideways scrolling only (for long option lists): with overflow-x set, CSS
  // would otherwise let the bigger invisible tap areas scroll it up and down.
  return (
    <div className="bq-segmented-row" ref={ref}>
      {thumb}
      {options.map((o) => {
        const on = o.value === shown;
        return (
          <button
            key={o.value}
            className="bq-hit bq-still bq-segmented-btn"
            data-thumb-on={on ? "" : undefined}
            onClick={() => pick(o.value)}
            aria-pressed={on}
            style={{ color: on ? "var(--color-text-primary-default)" : "var(--color-text-secondary-default)", transition: tr("color", QUICK_MS) }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

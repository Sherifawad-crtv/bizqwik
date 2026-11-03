import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EASE } from "../lib/motion";

const THUMB_MS = 300;

/** The sliding highlight behind a row of pill options (the selected pill glides
 * to the new choice instead of jumping). Give the container `ref`, render
 * `thumb` as its first child, mark the selected option `data-thumb-on`. */
export function useSlidingThumb(value: string) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  const [armed, setArmed] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const on = el.querySelector<HTMLElement>("[data-thumb-on]");
      setBox(on ? { x: on.offsetLeft, w: on.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure); // fonts loading or a resize change the widths
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  // No slide on first paint, only on real changes.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const thumb = box ? (
    <span
      aria-hidden
      style={{
        position: "absolute",
        top: 4,
        bottom: 4,
        left: 0,
        width: box.w,
        transform: `translateX(${box.x}px)`,
        borderRadius: 999,
        background: "var(--surface)",
        // Always underneath the labels: in an isolated stack, below everything
        // in the control. (Without this Safari can paint the sliding pill over
        // the text as it passes.)
        zIndex: -1,
        pointerEvents: "none",
        transition: armed ? `transform ${THUMB_MS}ms ${EASE}, width ${THUMB_MS}ms ${EASE}` : "none",
      }}
    />
  ) : null;
  return { ref, thumb };
}

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
  useEffect(() => setShown(value), [value]);
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
            data-hit
            data-nopress
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

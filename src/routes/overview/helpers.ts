import { useEffect, useRef, useState } from "react";
import { monthAbbr } from "../../lib/format";

export function useMeasuredWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** A bar's outline: rounded top corners (the "data end"), square at the baseline. */
export function roundedTopBarPath(x: number, yTop: number, w: number, yBottom: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, yBottom - yTop));
  return [`M${x},${yBottom}`, `L${x},${yTop + rr}`, `Q${x},${yTop} ${x + rr},${yTop}`, `L${x + w - rr},${yTop}`, `Q${x + w},${yTop} ${x + w},${yTop + rr}`, `L${x + w},${yBottom}`, "Z"].join(" ");
}

export function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

export function caption(months: string[]): string {
  if (months.length === 0) return "";
  const first = months[0];
  const last = months[months.length - 1];
  const year = last.slice(0, 4);
  return months.length === 1 ? `${monthAbbr(last)} ${year}`.toUpperCase() : `${monthAbbr(first)} – ${monthAbbr(last)} ${year}`.toUpperCase();
}

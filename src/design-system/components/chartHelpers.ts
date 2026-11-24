import { useEffect, useRef, useState } from "react";
import { monthAbbr } from "../format";

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

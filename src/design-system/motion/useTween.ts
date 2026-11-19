import { useEffect, useRef, useState } from "react";
import { SCREEN_MS } from "./motion";
import { useReducedMotion } from "./useReducedMotion";

// The iOS curve (cubic-bezier(.32,.72,0,1)) as a function of time 0..1.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    return sy(Math.min(1, Math.max(0, t)));
  };
}
const ease = bezier(0.32, 0.72, 0, 1);

/** Numbers that glide to new values instead of jumping: on first show they
 * grow from 0, and when they change they travel from where they are now.
 * Values are matched by key, so a new item grows in and the rest move. */
export function useTween(values: number[], keys: string[], ms = SCREEN_MS, fromZero = true): number[] {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<number[]>(() => (fromZero && !reduced ? values.map(() => 0) : values));
  const current = useRef<Map<string, number>>(new Map(keys.map((k, i) => [k, fromZero && !reduced ? 0 : values[i]])));
  const sig = values.join(",") + "|" + keys.join(",");
  useEffect(() => {
    if (reduced) {
      current.current = new Map(keys.map((k, i) => [k, values[i]]));
      setShown(values);
      return;
    }
    const start = keys.map((k) => current.current.get(k) ?? 0);
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      const e = ease(p);
      const next = values.map((v, i) => start[i] + (v - start[i]) * e);
      current.current = new Map(keys.map((k, i) => [k, next[i]]));
      setShown(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // Deliberate: re-run only when the numbers or their keys actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, reduced, ms]);
  return shown.length === values.length ? shown : values;
}

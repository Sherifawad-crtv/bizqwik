import { useEffect, useState } from "react";

const query = "(prefers-reduced-motion: reduce)";

/** True when the person has asked their phone for less motion (Settings →
 * Accessibility → Motion → Reduce Motion). Movement then becomes a fade. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/* oxlint-disable react/refs -- Deliberate: these two hold "the last value" in a ref that is read while
   rendering. Callers pass a fresh object on every render, so keeping it in state would re-render
   forever (this was tried: "Too many re-renders"). */
import { useEffect, useRef, useState } from "react";

// Keeps returning the last non-null value even after `value` itself goes
// null — so a closing sheet's title/body (built from that value) don't go
// blank or crash mid-exit-animation, while `open` (driven off the real
// value) still correctly flips to false and lets the sheet close.
export function useLatch<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value != null) ref.current = value;
  return ref.current;
}

/** The value as it was when the sheet last opened, so a closing sheet doesn't
 * change its own title or fields while it slides away. */
export function useFrozen<T>(open: boolean, value: T): T {
  const ref = useRef<T>(value);
  if (open) ref.current = value;
  return ref.current;
}

/** True while open and for the length of the exit animation after, so a sheet
 * component keeps rendering (and can slide out) instead of vanishing. */
export function useMountedThroughExit(open: boolean, ms = 450): boolean {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [open, ms]);
  return open || mounted;
}

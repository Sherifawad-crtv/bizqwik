import { useRef } from "react";

// Keeps returning the last non-null value even after `value` itself goes
// null — so a closing sheet's title/body (built from that value) don't go
// blank or crash mid-exit-animation, while `open` (driven off the real
// value) still correctly flips to false and lets the sheet close.
export function useLatch<T>(value: T | null): T | null {
  const ref = useRef<T | null>(value);
  if (value != null) ref.current = value;
  return ref.current;
}

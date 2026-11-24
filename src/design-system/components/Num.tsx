import { fmt } from "../format";
import { useTween } from "../motion/useTween";
import { CONTROL_MS } from "../motion/motion";

/** A money figure that glides to its new value when it changes (a new period,
 * a refresh), instead of jumping. On first show it simply appears. */
export function Num({ value, format = fmt }: { value: number; format?: (n: number) => string }) {
  const [shown] = useTween([value], ["v"], CONTROL_MS, false);
  // Snap to the exact figure at the end, so rounding never shows a wrong number at rest.
  const display = Math.abs(shown - value) < 0.5 ? value : Math.round(shown);
  return <span className="tabular">{format(display)}</span>;
}

import { CONTROL_MS, STANDARD_MS, tr } from "../motion/motion";

/** The switch's look. The knob slides on the system curve and the track colour
 * fades, and it answers the moment you tap (callers flip it straight away and
 * only revert if the action fails). `animate` is off for a first paint that is
 * only correcting itself, so it doesn't visibly slide on arrival. */
export function SwitchVisual({ checked, animate = true, busy }: { checked: boolean; animate?: boolean; busy?: boolean }) {
  return (
    <span className="bq-switch-switch-visual-box"
      aria-hidden
      style={{ background: checked ? "var(--color-bg-fill-primary-default)" : "var(--color-bg-surface-secondary-default)", boxShadow: checked ? "none" : "inset 0 0 0 1px var(--color-border-primary-default)", transition: animate ? tr(["background", "box-shadow"], STANDARD_MS) : "none", opacity: busy ? 0.85 : 1 }}
    >
      <span className="bq-switch-switch-visual-layer"
        style={{ transform: `translateX(${checked ? 19 : 0}px)`, transition: animate ? tr("transform", CONTROL_MS) : "none" }}
      />
    </span>
  );
}

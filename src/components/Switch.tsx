import { EASE } from "../lib/motion";

/** The switch's look. The knob slides on the system curve and the track colour
 * fades, and it answers the moment you tap (callers flip it straight away and
 * only revert if the action fails). `animate` is off for a first paint that is
 * only correcting itself, so it doesn't visibly slide on arrival. */
export function SwitchVisual({ checked, animate = true, busy }: { checked: boolean; animate?: boolean; busy?: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        flex: "none",
        display: "block",
        position: "relative",
        width: 44,
        height: 26,
        borderRadius: 999,
        background: checked ? "var(--primary)" : "var(--sunken)",
        boxShadow: checked ? "none" : "inset 0 0 0 1px var(--line)",
        transition: animate ? "background .25s ease, box-shadow .25s ease" : "none",
        opacity: busy ? 0.85 : 1,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 21,
          height: 21,
          borderRadius: 999,
          background: "var(--surface)",
          boxShadow: "0 1px 3px rgba(0,0,0,.25)",
          transform: `translateX(${checked ? 19 : 0}px)`,
          transition: animate ? `transform .3s ${EASE}` : "none",
        }}
      />
    </span>
  );
}

/** A standalone switch (a button with the right semantics). */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      data-hit
      onClick={() => onChange(!checked)}
      style={{ border: 0, background: "none", padding: 0, cursor: disabled ? "default" : "pointer", display: "flex" }}
    >
      <SwitchVisual checked={checked} />
    </button>
  );
}

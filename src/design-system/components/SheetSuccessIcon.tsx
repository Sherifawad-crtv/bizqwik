import { CONTROL_MS, EASE, QUICK_MS, SCREEN_MS, SPRING, STANDARD_MS, tr } from "../motion/motion";

const CIRCLE_LEN = 176; // 2π × r(28), rounded
const CHECK_LEN = 42; // length of the two-segment check path

/** Big animating checkmark shown inside a sheet in place of its form/prompt
 * content once an action succeeds — pops in, then the sheet auto-closes.
 * Always the app's primary color: this is a success/confirm state, not a
 * severity indicator, and the sheet content that came before already made
 * the destructive/non-destructive distinction clear. */
export function SheetSuccessIcon({ label, iconIn }: { label: string; iconIn: boolean }) {
  return (
    <div className="bq-sheet-success-icon-stack" data-sheet-clean>
      <div className="bq-sheet-success-icon-row"
        aria-hidden
        style={{ transform: iconIn ? "scale(1)" : "scale(0.7)", opacity: iconIn ? 1 : 0, transition: `${tr("transform", SCREEN_MS, SPRING)}, ${tr("opacity", QUICK_MS)}` }}
      >
        <svg width={44} height={44} viewBox="0 0 64 64" fill="none">
          <circle
            cx={32}
            cy={32}
            r={28}
            stroke="var(--color-bg-fill-primary-default)"
            strokeWidth={3}
            strokeLinecap="round"
            style={{
              strokeDasharray: CIRCLE_LEN,
              strokeDashoffset: iconIn ? 0 : CIRCLE_LEN,
              transition: tr("stroke-dashoffset", CONTROL_MS),
            }}
          />
          <path
            d="M18 34 L27 43 L46 21"
            stroke="var(--color-bg-fill-primary-default)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: CHECK_LEN,
              strokeDashoffset: iconIn ? 0 : CHECK_LEN,
              transition: tr("stroke-dashoffset", STANDARD_MS, EASE, 100),
            }}
          />
        </svg>
      </div>
      <div className="bq-sheet-success-icon-title">{label}</div>
    </div>
  );
}

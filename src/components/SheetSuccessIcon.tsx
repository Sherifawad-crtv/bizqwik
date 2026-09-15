const CIRCLE_LEN = 176; // 2π × r(28), rounded
const CHECK_LEN = 42; // length of the two-segment check path

/** Big animating checkmark shown inside a sheet in place of its form/prompt
 * content once an action succeeds — pops in, then the sheet auto-closes.
 * Always the app's primary color: this is a success/confirm state, not a
 * severity indicator, and the sheet content that came before already made
 * the destructive/non-destructive distinction clear. */
export function SheetSuccessIcon({ label, iconIn }: { label: string; iconIn: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 4px 10px" }}>
      <div
        aria-hidden
        style={{
          width: 84,
          height: 84,
          borderRadius: 999,
          background: "var(--primary-tint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: iconIn ? "scale(1)" : "scale(0.7)",
          opacity: iconIn ? 1 : 0,
          transition: "transform .35s cubic-bezier(.34,1.56,.64,1), opacity .2s ease",
        }}
      >
        <svg width={44} height={44} viewBox="0 0 64 64" fill="none">
          <circle
            cx={32}
            cy={32}
            r={28}
            stroke="var(--primary)"
            strokeWidth={3}
            strokeLinecap="round"
            style={{
              strokeDasharray: CIRCLE_LEN,
              strokeDashoffset: iconIn ? 0 : CIRCLE_LEN,
              transition: "stroke-dashoffset .5s cubic-bezier(.65,0,.35,1)",
            }}
          />
          <path
            d="M18 34 L27 43 L46 21"
            stroke="var(--primary)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: CHECK_LEN,
              strokeDashoffset: iconIn ? 0 : CHECK_LEN,
              transition: "stroke-dashoffset .3s ease-out .35s",
            }}
          />
        </svg>
      </div>
      <div style={{ marginTop: 16, font: "700 16px var(--font-body)", color: "var(--ink)" }}>{label}</div>
    </div>
  );
}

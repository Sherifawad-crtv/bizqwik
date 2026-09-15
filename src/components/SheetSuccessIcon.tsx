import { Icon } from "./Icon";

/** Big animating checkmark shown inside a sheet in place of its form/prompt
 * content once an action succeeds — pops in, then the sheet auto-closes. */
export function SheetSuccessIcon({ label, iconIn, danger }: { label: string; iconIn: boolean; danger?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 4px 10px" }}>
      <div
        aria-hidden
        style={{
          width: 84,
          height: 84,
          borderRadius: 999,
          background: danger ? "var(--danger-bg)" : "var(--paid-bg)",
          color: danger ? "var(--danger-fg)" : "var(--paid-fg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: iconIn ? "scale(1)" : "scale(0.4)",
          opacity: iconIn ? 1 : 0,
          transition: "transform .4s cubic-bezier(.34,1.56,.64,1), opacity .25s ease",
        }}
      >
        <Icon name="check" size={44} solid />
      </div>
      <div style={{ marginTop: 16, font: "700 16px var(--font-body)", color: "var(--ink)" }}>{label}</div>
    </div>
  );
}

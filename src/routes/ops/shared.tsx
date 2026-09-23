import type { ReactNode } from "react";
import type { OrgStatus } from "../../lib/types";
import { ORG_STATUS_LABELS } from "../../lib/types";

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", ...style }}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, count, right }: { children: ReactNode; count?: number | string; right?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 2px 12px" }}>
      <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>{children}</span>
      {count !== undefined && <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{count}</span>}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

export function ErrorBanner({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
      {text}
    </div>
  );
}

const STATUS_TONE: Record<OrgStatus, { fg: string; bg: string }> = {
  trial: { fg: "var(--logging-fg)", bg: "var(--logging-bg)" },
  active: { fg: "var(--paid-fg)", bg: "var(--paid-bg)" },
  paused: { fg: "var(--danger-fg)", bg: "var(--danger-bg)" },
};

export function StatusPill({ status }: { status: OrgStatus }) {
  const c = STATUS_TONE[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        font: "700 11px var(--font-mono)",
        letterSpacing: ".08em",
        whiteSpace: "nowrap",
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: 999, background: c.fg, display: "block" }} />
      {ORG_STATUS_LABELS[status].toUpperCase()}
    </span>
  );
}

export function limitLabel(n: number | null): string {
  return n === null ? "Unlimited" : String(n);
}

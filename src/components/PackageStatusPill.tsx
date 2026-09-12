import { PACKAGE_STATUS_LABELS } from "../lib/types";
import type { PackageStatus } from "../lib/types";

const PKG_COLORS: Record<PackageStatus, { fg: string; bg: string }> = {
  active: { fg: "var(--paid-fg)", bg: "var(--paid-bg)" },
  exhausted: { fg: "var(--ink-muted)", bg: "var(--sunken)" },
  expired: { fg: "var(--danger-fg)", bg: "var(--danger-bg)" },
};

export function PackageStatusPill({ status }: { status: PackageStatus }) {
  const c = PKG_COLORS[status];
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
      {PACKAGE_STATUS_LABELS[status].toUpperCase()}
    </span>
  );
}

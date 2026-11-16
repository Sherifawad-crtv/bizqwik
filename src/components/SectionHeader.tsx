import type { ReactNode } from "react";

/** A section's heading: the title, an optional count beside it, and an optional
 * action on the right (a "see all" link, an add button). */
export function SectionHeader({ children, count, right, rise }: { children: ReactNode; count?: number | string; right?: ReactNode; rise?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 2px 12px" }}>
      <span className="bq-h2">{children}</span>
      {count !== undefined && <span className={rise ? "bq-meta bq-rise" : "bq-meta"}>{count}</span>}
      {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
    </div>
  );
}

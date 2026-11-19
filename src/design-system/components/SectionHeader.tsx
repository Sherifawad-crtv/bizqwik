import type { ReactNode } from "react";

/** A section's heading: the title, an optional count beside it, and an optional
 * action on the right (a "see all" link, an add button). */
export function SectionHeader({ children, count, right, rise }: { children: ReactNode; count?: number | string; right?: ReactNode; rise?: boolean }) {
  return (
    <div className="bq-section-header-row">
      <span className="bq-h2">{children}</span>
      {count !== undefined && <span className={rise ? "bq-meta bq-rise" : "bq-meta"}>{count}</span>}
      {right && <div className="bq-ml-auto">{right}</div>}
    </div>
  );
}

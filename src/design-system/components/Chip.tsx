import type { ReactNode } from "react";

/** A selectable filter or choice (on / off). size sm for dense rows. */
export function Chip({ on, onClick, children, size, testId }: { on: boolean; onClick: () => void; children: ReactNode; size?: "sm"; testId?: string }) {
  return (
    <button type="button" data-testid={testId} aria-pressed={on} className={size === "sm" ? "bq-chip bq-chip--sm bq-still" : "bq-chip bq-still"} onClick={onClick}>
      {children}
    </button>
  );
}

/** Chips in a row that wraps. */
export function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="bq-chip-chip-group-row">{children}</div>;
}

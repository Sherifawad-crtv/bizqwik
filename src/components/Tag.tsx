import type { HTMLAttributes, ReactNode } from "react";

export type Tone = "neutral" | "primary" | "logging" | "settled" | "paid" | "danger" | "frozen";

/** A small square label: Kids, a location name, OFF SALE, MANUAL. */
export function Tag({ tone = "neutral", children, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; children: ReactNode }) {
  return (
    <span className={["bq-tag", `bq-tone-${tone}`, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </span>
  );
}

/** A pill with a dot that says what state something is in (LOGGED, PAID, ACTIVE…). */
export function StatusBadge({ tone, children, className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone: Tone; children: ReactNode }) {
  return (
    <span className={["bq-badge", `bq-tone-${tone}`, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </span>
  );
}

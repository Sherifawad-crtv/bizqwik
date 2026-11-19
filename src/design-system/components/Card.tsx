import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

export type CardPad = "none" | "sm" | "md" | "lg";

/** Every surface on a page: the warm-white rounded card (radius 28, no stroke).
 * pad: none (it holds ListRows), sm 14×16 (rows, tiles), md 20 (sections), lg 30 (sign-in).
 * `clip` hides overflow (lists with dividers). */
export function Card({ pad = "md", clip, className, ...rest }: HTMLAttributes<HTMLDivElement> & { pad?: CardPad; clip?: boolean }) {
  return <div className={cardClass(pad, clip, className)} {...rest} />;
}

/** The same classes, for a card that has to be another element (a button, a label). */
export function cardClass(pad: CardPad = "md", clip?: boolean, extra?: string) {
  return ["bq-card", pad !== "none" && `bq-card--${pad}`, clip && "bq-card--clip", extra].filter(Boolean).join(" ");
}

/** A card with a small label on top (and an optional line under it), then its content. */
export function SectionCard({ title, sub, children, style }: { title: string; sub?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div className={cardClass("md")} style={{ marginBottom: 14, ...style }}>
      <div className="bq-label">{title}</div>
      {sub && <div className="bq-card-section-card-meta">{sub}</div>}
      <div className="bq-mt-4">{children}</div>
    </div>
  );
}

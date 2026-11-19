import { Avatar } from "./Avatar";
import { StatePill } from "./StatePill";
import { Icon } from "./Icon";
import { EmptyState } from "./EmptyState";
import type { ComponentProps } from "react";

type EmptyProps = Partial<ComponentProps<typeof EmptyState>>;
import { useIsMobile } from "../lib/useIsMobile";
import type { State } from "../lib/types";
import { egp } from "../lib/format";

export interface ListRow {
  id: string;
  name: string;
  avatarUrl?: string | null;
  title: string;
  meta: string;
  sub?: string;
  state?: State;
  amount: number;
  onClick?: () => void;
}

function DesktopRow({ r }: { r: ListRow }) {
  return (
    <div
      onClick={r.onClick}
      className={r.onClick ? "bq-row" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.3fr 1fr 1.1fr 20px",
        gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid var(--color-border-primary-default)",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={r.name} size={32} src={r.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "600 var(--text-callout-size) var(--font-family-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
          {r.sub && <div className="bq-meta">{r.sub}</div>}
        </div>
      </div>
      <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.meta}</div>
      <div>{r.state && <StatePill state={r.state} />}</div>
      <div className="tabular bq-stat-sm" style={{ textAlign: "right" }}>{egp(r.amount)}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", color: "var(--color-text-tertiary-default)" }}>
        {r.onClick && <Icon name="chevron-right" size={16} />}
      </div>
    </div>
  );
}

export function RollupTable({
  colA,
  colB,
  rows,
  empty,
}: {
  colA: string;
  colB: string;
  rows: ListRow[];
  /** Why the list is empty and what to do about it. */
  empty?: EmptyProps;
}) {
  const isMobile = useIsMobile();

  if (rows.length === 0) {
    return <EmptyState icon="coaches" title="Nothing here yet" {...empty} />;
  }

  if (isMobile) {
    return (
      <div className="bq-stack">
        {rows.map((r) => (
          <div
            key={r.id}
            onClick={r.onClick}
            className="bq-card bq-card--sm" style={{ display: "flex", gap: 14, alignItems: "center", cursor: r.onClick ? "pointer" : "default" }}
          >
            <Avatar name={r.name} size={38} src={r.avatarUrl} />
            <div className="bq-grow">
              <div style={{ font: "700 var(--text-callout-size) var(--font-family-body)", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
              <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.meta}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                {r.state && <StatePill state={r.state} />}
                {r.sub && <span className="bq-meta">{r.sub}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div className="tabular bq-stat-sm" >{egp(r.amount).split(" ")[0]}</div>
              <div className="bq-label">EGP</div>
            </div>
            {r.onClick && (
              <span style={{ flex: "none", color: "var(--color-text-tertiary-default)", display: "flex" }}>
                <Icon name="chevron-right" size={16} />
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bq-panel">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 1.1fr 20px", gap: 12, padding: "10px 20px", background: "var(--color-bg-surface-secondary-default)", font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-secondary-default)" }}>
        <span>{colA}</span>
        <span>{colB}</span>
        <span>STATUS</span>
        <span style={{ textAlign: "right" }}>AMOUNT</span>
        <span />
      </div>
      {rows.map((r) => (
        <DesktopRow key={r.id} r={r} />
      ))}
    </div>
  );
}

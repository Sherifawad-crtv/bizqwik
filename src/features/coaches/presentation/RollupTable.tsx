import { cx } from "../../../design-system/cx";
import { Avatar } from "../../../design-system/components/Avatar";
import { StatePill } from "../../../shared/components/StatePill";
import { Icon } from "../../../design-system/components/Icon";
import { EmptyState } from "../../../design-system/components/EmptyState";
import type { ComponentProps } from "react";

type EmptyProps = Partial<ComponentProps<typeof EmptyState>>;
import { useIsMobile } from "../../../design-system/hooks/useIsMobile";
import type { State } from "../../../shared/types";
import { egp } from "../../../shared/format";
import "./RollupTable.css";

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
      className={cx(r.onClick ? "bq-row" : undefined, "bq-coaches-rollup-table-desktop-row-grid")}
    >
      <div className="bq-flex bq-items-center bq-gap-3 bq-min-w-0">
        <Avatar name={r.name} size={32} src={r.avatarUrl} />
        <div className="bq-min-w-0">
          <div className="bq-coaches-rollup-table-desktop-row-text">{r.title}</div>
          {r.sub && <div className="bq-meta">{r.sub}</div>}
        </div>
      </div>
      <div className="bq-coaches-rollup-table-desktop-row-meta">{r.meta}</div>
      <div>{r.state && <StatePill state={r.state} />}</div>
      <div className="tabular bq-stat-sm bq-text-right">{egp(r.amount)}</div>
      <div className="bq-flex bq-justify-end bq-fg-tertiary">
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
            className="bq-card bq-card--sm bq-flex bq-gap-4 bq-items-center" style={{ cursor: r.onClick ? "pointer" : "default" }}
          >
            <Avatar name={r.name} size={38} src={r.avatarUrl} />
            <div className="bq-grow">
              <div className="bq-coaches-rollup-table-title">{r.title}</div>
              <div className="bq-coaches-rollup-table-meta">{r.meta}</div>
              <div className="bq-mt-2 bq-flex bq-gap-2 bq-items-center">
                {r.state && <StatePill state={r.state} />}
                {r.sub && <span className="bq-meta">{r.sub}</span>}
              </div>
            </div>
            <div className="bq-text-right bq-flex-none">
              <div className="tabular bq-stat-sm" >{egp(r.amount).split(" ")[0]}</div>
              <div className="bq-label">EGP</div>
            </div>
            {r.onClick && (
              <span className="bq-flex-none bq-fg-tertiary bq-flex">
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
      <div className="bq-coaches-rollup-table-label">
        <span>{colA}</span>
        <span>{colB}</span>
        <span>STATUS</span>
        <span className="bq-text-right">AMOUNT</span>
        <span />
      </div>
      {rows.map((r) => (
        <DesktopRow key={r.id} r={r} />
      ))}
    </div>
  );
}

import { EmptyState } from "./EmptyState";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";


export function Empty({ text }: { text: string }) {
  return <EmptyState bare icon="insights" title={text} body="This fills in automatically as the front desk sells plans, packages and drop-ins." />;
}

/** Change vs the previous equal period. `tone` says how to colour it: revenue
 * and profit going up is good, payouts going up is just information. */
export function Delta({ pct, tone }: { pct: number | null; tone: "good" | "neutral" }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const flat = Math.abs(pct) < 0.05;
  const color = tone === "neutral" || flat ? "var(--color-text-secondary-default)" : up ? "var(--color-text-status-paid-default)" : "var(--color-text-status-danger-default)";
  const bg = tone === "neutral" || flat ? "var(--color-bg-surface-secondary-default)" : up ? "var(--color-bg-fill-status-paid-default)" : "var(--color-bg-fill-status-danger-default)";
  return (
    <span className="tabular bq-kpi-tile-delta-label" style={{ background: bg, color }}>
      {flat ? "–" : up ? "▲" : "▼"} {Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : (Math.round(Math.abs(pct) * 10) / 10).toString()}%
    </span>
  );
}

export function KpiTile({ label, value, sub, icon, delta }: { label: string; value: ReactNode; sub?: string; icon: IconName; delta?: ReactNode }) {
  return (
    <div className="bq-card bq-card--sm bq-min-w-0">
      <div className="bq-flex bq-items-center bq-gap-2">
        <span className="bq-kpi-tile-row">
          <Icon name={icon} size={16} />
        </span>
        <span className="bq-ml-auto">{delta}</span>
      </div>
      <div className="bq-kpi-tile-label">{label}</div>
      <div className="tabular bq-stat-md bq-kpi-tile-part">{value}</div>
      {sub && <div className="bq-kpi-tile-meta">{sub}</div>}
    </div>
  );
}

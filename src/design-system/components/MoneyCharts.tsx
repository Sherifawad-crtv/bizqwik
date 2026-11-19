import { EmptyState } from "./EmptyState";
import { fmt, monthAbbr } from "../../shared/format";
import type { RevenueReport, RevenueSlice } from "../../shared/types";
import { BarChart } from "./BarChart";
import { Empty } from "./KpiTile";

/** Revenue vs coach payouts per month, as one soft bar chart (see BarChart). */
export function RevenueChart({ months, revenueOnly = false }: { months: RevenueReport["months"]; revenueOnly?: boolean }) {
  if (months.every((m) => m.revenue === 0 && (revenueOnly || m.payouts === 0))) {
    if (revenueOnly) return <EmptyState bare icon="insights" title="No sales yet" body="Once you sell a plan, this chart fills in month by month." />;
    return <EmptyState bare icon="insights" title="No sales or payouts yet" body="Once the front desk starts selling and coaches log sessions, this chart fills in month by month." />;
  }
  return (
    <BarChart
      ariaLabel="Revenue and coach payouts by month"
      aLabel="Revenue"
      bLabel={revenueOnly ? undefined : "Coach payouts"}
      data={months.map((m) => ({
        key: m.month,
        label: monthAbbr(m.month),
        a: m.revenue,
        b: revenueOnly ? undefined : m.payouts,
        tip: { title: monthAbbr(m.month), lines: revenueOnly ? [`Revenue ${fmt(m.revenue)}`] : [`Revenue ${fmt(m.revenue)}`, `Payouts ${fmt(m.payouts)}`, `Profit ${fmt(m.profit)}`] },
      }))}
    />
  );
}

/** Share bars for a breakdown: label, amount and % of the total. */
export function ShareBars({ slices }: { slices: RevenueSlice[] }) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) return <Empty text="No sales in this period yet." />;
  return (
    <div className="bq-flex bq-col bq-gap-3">
      {slices.map((s) => {
        const pct = (s.amount / total) * 100;
        return (
          <div key={s.key}>
            <div className="bq-flex bq-items-baseline bq-gap-2 bq-mb-1">
              <span className="bq-money-charts-share-bars-text">{s.label}</span>
              <span className="tabular bq-money-charts-share-bars-title">{fmt(s.amount)}</span>
              <span className="tabular bq-money-charts-share-bars-meta">{Math.round(pct)}%</span>
            </div>
            <div className="bq-money-charts-share-bars-box">
              <div className="bq-money-charts-share-bars-box-2" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

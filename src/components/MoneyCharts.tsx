import { EmptyState } from "./EmptyState";
import { fmt, monthAbbr } from "../lib/format";
import type { RevenueReport, RevenueSlice } from "../lib/types";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {slices.map((s) => {
        const pct = (s.amount / total) * 100;
        return (
          <div key={s.key}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
              <span style={{ flex: 1, minWidth: 0, font: "600 var(--fs-body-sm) var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
              <span className="tabular" style={{ font: "800 var(--fs-body-sm) var(--font-body)" }}>{fmt(s.amount)}</span>
              <span className="tabular" style={{ width: 40, textAlign: "right", font: "600 var(--fs-small) var(--font-mono)", color: "var(--ink-faint)" }}>{Math.round(pct)}%</span>
            </div>
            <div style={{ height: 8, background: "var(--sunken)", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)", borderRadius: "0 4px 4px 0" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

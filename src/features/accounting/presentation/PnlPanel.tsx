import { EmptyState } from "../../../design-system/components/EmptyState";
import { fmt, monthAbbr, monthLabel } from "../../../shared/format";
import type { PnlReport } from "../../../shared/types";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { Spinner } from "../../../design-system/components/Spinner";
import { KpiTile, Delta } from "../../../design-system/components/KpiTile";
import { SectionCard } from "../../../design-system/components/Card";
import { pctChange, caption } from "../../../design-system/components/chartHelpers";
import { BarChart } from "../../../design-system/components/BarChart";
import { ShareBars } from "../../../design-system/components/MoneyCharts";
import { Num } from "../../../design-system/components/Num";
import { hasNoActivity, isEmptyReport, previousMonth, profitMargin, stillOwed } from "../domain/accounting";
import "./PnlPanel.css";

function PnlChart({ trend }: { trend: PnlReport["trend"] }) {
  if (hasNoActivity(trend)) {
    return <EmptyState bare icon="insights" title="No activity yet" body="Once there's revenue or an expense logged, this fills in month by month." />;
  }
  return (
    <BarChart
      ariaLabel="Net revenue and expenses by month"
      aLabel="Net revenue"
      bLabel="Expenses"
      data={trend.map((m) => ({
        key: m.month,
        label: monthAbbr(m.month),
        a: m.netRevenue,
        b: m.totalExpenses,
        tip: { title: monthAbbr(m.month), lines: [`Net revenue ${fmt(m.netRevenue)}`, `Expenses ${fmt(m.totalExpenses)}`, `Profit ${fmt(m.profit)}`] },
      }))}
    />
  );
}

export function PnlPanel({ report, loading, onAddExpense, onCoachPayouts }: { report: PnlReport | null; loading: boolean; onAddExpense: () => void; onCoachPayouts: () => void }) {
  if (loading || !report) return <Spinner />;
  if (isEmptyReport(report)) {
    return (
      <EmptyState
        icon="cash"
        title="Nothing to show yet"
        body="Profit & loss fills in once there's revenue or an expense logged. Rent, salaries, utilities and the other default categories are already set up — add your first expense to get started."
        action={{ label: "Add an expense", onClick: onAddExpense }}
      />
    );
  }
  const { current } = report;
  const prev = previousMonth(report);
  const margin = profitMargin(current);

  return (
    <>
      {report.unsettledNote && (
        <div className="bq-accounting-pnl-panel-row">
          <span className="bq-accounting-pnl-panel-row-2">
            <Icon name="insights" size={18} />
          </span>
          <span className="bq-accounting-pnl-panel-text">
            {report.unsettledNote.count} coach session{report.unsettledNote.count === 1 ? "" : "s"} {report.unsettledNote.count === 1 ? "isn't" : "aren't"} settled yet, so payouts may be understated.
          </span>
        </div>
      )}

      <div className="bq-card bq-accounting-pnl-panel-spacing">
        <div className="bq-flex bq-items-center bq-gap-2">
          <span className="bq-label">REVENUE · EGP</span>
          {prev && <span className="bq-ml-auto"><Delta pct={pctChange(current.netRevenue, prev.netRevenue)} tone="good" /></span>}
        </div>
        <div className="tabular bq-accounting-pnl-panel-title">{fmt(current.netRevenue)}</div>
        <div className="bq-accounting-pnl-panel-meta">
          {current.refunds > 0 ? `${fmt(current.grossRevenue)} gross − ${fmt(current.refunds)} refunded` : "No refunds this month"}
        </div>
      </div>

      <div className="bq-accounting-pnl-panel-grid">
        <KpiTile label="EXPENSES" icon="topay" value={<Num value={current.totalExpenses} />} sub={`${fmt(current.coachPayouts)} coach payouts`} delta={prev && <Delta pct={pctChange(current.totalExpenses, prev.totalExpenses)} tone="neutral" />} />
        <KpiTile label="PROFIT" icon="insights" value={<Num value={current.profit} />} sub={margin !== null ? `${margin >= 0 ? "" : "−"}${Math.abs(Math.round(margin))}% margin` : "Margin needs revenue"} delta={prev && <Delta pct={pctChange(current.profit, prev.profit)} tone="good" />} />
      </div>

      <SectionCard title="NET REVENUE VS EXPENSES" sub={`${caption(report.trend.map((m) => m.month))} · BY MONTH · EGP`}>
        <PnlChart trend={report.trend} />
      </SectionCard>

      <SectionCard title="WHERE THE MONEY CAME FROM" sub={`${monthLabel(current.month).toUpperCase()} · EGP`}>
        <ShareBars slices={report.revenueBySource} />
      </SectionCard>

      <SectionCard title="WHERE THE MONEY WENT" sub={`${monthLabel(current.month).toUpperCase()} · EGP`}>
        {report.expensesBySource.length === 0 ? (
          <EmptyState bare icon="insights" title="No expenses this month" body="Coach payouts and whatever you log show up here, largest first." />
        ) : (
          <div className="bq-stack">
            {report.expensesBySource.map((s) => (
              <button
                key={s.key}
                className="bq-scale bq-accounting-pnl-panel-btn"
                onClick={s.key === "coach_payouts" ? onCoachPayouts : undefined}
                disabled={s.key !== "coach_payouts"}
                style={{ cursor: s.key === "coach_payouts" ? "pointer" : "default" }}
              >
                <span className="bq-grow">
                  <div className="bq-accounting-pnl-panel-text-2">{s.label}</div>
                  {s.key === "coach_payouts" && (
                    <div className="bq-accounting-pnl-panel-meta-2">
                      {s.paid !== undefined ? `${fmt(s.paid)} paid · ${fmt(stillOwed(s.amount, s.paid))} still owed · ` : ""}Locked · settled only
                    </div>
                  )}
                </span>
                <span className="tabular bq-accounting-pnl-panel-title-2">{fmt(s.amount)}</span>
                {s.key === "coach_payouts" && <Icon name="chevron-right" size={14} className="bq-fg-tertiary" />}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <Button className="bq-mt-1 bq-mb-4" fullWidth size="lg" onClick={onAddExpense}>
        Add expense
      </Button>
    </>
  );
}

// ---- Expenses ---------------------------------------------------------

import { EmptyState } from "../../components/EmptyState";
import { fmt, monthAbbr, monthLabel } from "../../lib/format";
import type { PnlReport } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { KpiTile, Delta } from "../../components/KpiTile";
import { SectionCard } from "../../components/Card";
import { pctChange, caption } from "../../lib/chartHelpers";
import { BarChart } from "../../components/BarChart";
import { ShareBars } from "../../components/MoneyCharts";
import { Num } from "../../components/Num";

function PnlChart({ trend }: { trend: PnlReport["trend"] }) {
  if (trend.every((m) => m.netRevenue === 0 && m.totalExpenses === 0)) {
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
  if (!report.hasPastExpenses && report.current.grossRevenue === 0) {
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
  const prev = report.trend.length >= 2 ? report.trend[report.trend.length - 2] : null;
  const margin = current.netRevenue > 0 ? (current.profit / current.netRevenue) * 100 : null;

  return (
    <>
      {report.unsettledNote && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--logging-bg)", borderRadius: "var(--r-item)", padding: "12px 14px", marginBottom: 14 }}>
          <span style={{ color: "var(--logging-fg)", display: "flex", flex: "none", marginTop: 1 }}>
            <Icon name="insights" size={18} />
          </span>
          <span style={{ font: "500 var(--fs-note)/1.5 var(--font-body)", color: "var(--logging-fg)" }}>
            {report.unsettledNote.count} coach session{report.unsettledNote.count === 1 ? "" : "s"} {report.unsettledNote.count === 1 ? "isn't" : "aren't"} settled yet, so payouts may be understated.
          </span>
        </div>
      )}

      <div className="bq-card" style={{ padding: "20px 20px 18px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="bq-label">REVENUE · EGP</span>
          {prev && <span style={{ marginLeft: "auto" }}><Delta pct={pctChange(current.netRevenue, prev.netRevenue)} tone="good" /></span>}
        </div>
        <div className="tabular" style={{ font: "800 48px/1 var(--font-body)", letterSpacing: "-.03em", margin: "8px 0 0", overflowWrap: "anywhere" }}>{fmt(current.netRevenue)}</div>
        <div style={{ font: "400 var(--fs-small)/1.4 var(--font-mono)", color: "var(--ink-faint)", marginTop: 8 }}>
          {current.refunds > 0 ? `${fmt(current.grossRevenue)} gross − ${fmt(current.refunds)} refunded` : "No refunds this month"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
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
                className="bq-scale"
                onClick={s.key === "coach_payouts" ? onCoachPayouts : undefined}
                disabled={s.key !== "coach_payouts"}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "none", padding: "6px 0", cursor: s.key === "coach_payouts" ? "pointer" : "default", textAlign: "left" }}
              >
                <span className="bq-grow">
                  <div style={{ font: "600 var(--fs-body-sm) var(--font-body)" }}>{s.label}</div>
                  {s.key === "coach_payouts" && (
                    <div style={{ font: "400 var(--fs-caption) var(--font-mono)", color: "var(--ink-faint)" }}>
                      {s.paid !== undefined ? `${fmt(s.paid)} paid · ${fmt(Math.max(0, s.amount - s.paid))} still owed · ` : ""}Locked · settled only
                    </div>
                  )}
                </span>
                <span className="tabular" style={{ font: "800 var(--fs-body-sm) var(--font-body)" }}>{fmt(s.amount)}</span>
                {s.key === "coach_payouts" && <Icon name="chevron-right" size={14} style={{ color: "var(--ink-faint)" }} />}
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <Button fullWidth size="lg" style={{ marginTop: 4, marginBottom: 18 }} onClick={onAddExpense}>
        Add expense
      </Button>
    </>
  );
}

// ---- Expenses ---------------------------------------------------------

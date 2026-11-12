import { EmptyState } from "../../components/EmptyState";
import { useState } from "react";
import { fmt, monthAbbr, monthLabel } from "../../lib/format";
import type { PnlReport } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { Card, KpiTile, Delta, pctChange, caption, ShareBars, useMeasuredWidth, roundedTopBarPath } from "../Oversight";

function PnlChart({ trend }: { trend: PnlReport["trend"] }) {
  const [ref, W] = useMeasuredWidth(320);
  const H = 210;
  const top = 26;
  const bottom = 172;
  const max = Math.max(...trend.map((m) => Math.max(m.netRevenue, m.totalExpenses)), 1) * 1.15;
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const slot = W / trend.length;
  const barW = Math.max(6, Math.min(18, slot / 3));
  const [hover, setHover] = useState<number | null>(null);
  const REV = "var(--primary)";
  const EXP = "var(--accent)";

  if (trend.every((m) => m.netRevenue === 0 && m.totalExpenses === 0)) {
    return <EmptyState bare icon="insights" title="No activity yet" body="Once there's revenue or an expense logged, this fills in month by month." />;
  }
  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        {[["Net revenue", REV], ["Expenses", EXP]].map(([label, color]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, font: "700 11px var(--font-mono)", letterSpacing: ".04em", color: "var(--ink-muted)" }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "block" }} />
            {String(label).toUpperCase()}
          </span>
        ))}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }} role="img" aria-label="Net revenue and expenses by month">
        {[top, (top + bottom) / 2, bottom].map((gy, i) => (
          <line key={i} x1={0} y1={gy} x2={W} y2={gy} stroke="var(--line)" strokeWidth={1} />
        ))}
        {trend.map((m, i) => {
          const cx = (i + 0.5) * slot;
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {m.netRevenue > 0 && <path d={roundedTopBarPath(cx - barW - 1, y(m.netRevenue), barW, bottom, 4)} fill={REV} />}
              {m.totalExpenses > 0 && <path d={roundedTopBarPath(cx + 1, y(m.totalExpenses), barW, bottom, 4)} fill={EXP} />}
              <text x={cx} y={H - 4} textAnchor="middle" style={{ font: "700 10px var(--font-mono)", letterSpacing: ".06em", fill: "var(--ink-faint)" }}>
                {monthAbbr(m.month).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div style={{ position: "absolute", top: 30, left: Math.min(Math.max((hover + 0.5) * slot - 80, 0), W - 160), width: 160, background: "var(--ink)", color: "var(--surface)", borderRadius: 12, padding: "8px 12px", font: "600 12px/1.6 var(--font-mono)", pointerEvents: "none" }}>
          <div style={{ fontWeight: 800 }}>{monthAbbr(trend[hover].month)}</div>
          <div>Net revenue {fmt(trend[hover].netRevenue)}</div>
          <div>Expenses {fmt(trend[hover].totalExpenses)}</div>
          <div>Profit {fmt(trend[hover].profit)}</div>
        </div>
      )}
    </div>
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
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--logging-bg)", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
          <span style={{ color: "var(--logging-fg)", display: "flex", flex: "none", marginTop: 1 }}>
            <Icon name="insights" size={18} />
          </span>
          <span style={{ font: "500 13px/1.5 var(--font-body)", color: "var(--logging-fg)" }}>
            {report.unsettledNote.count} coach session{report.unsettledNote.count === 1 ? "" : "s"} {report.unsettledNote.count === 1 ? "isn't" : "aren't"} settled yet, so payouts may be understated.
          </span>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "20px 20px 18px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="bq-label">REVENUE · EGP</span>
          {prev && <span style={{ marginLeft: "auto" }}><Delta pct={pctChange(current.netRevenue, prev.netRevenue)} tone="good" /></span>}
        </div>
        <div className="tabular" style={{ font: "800 48px/1 var(--font-body)", letterSpacing: "-.03em", margin: "8px 0 0", overflowWrap: "anywhere" }}>{fmt(current.netRevenue)}</div>
        <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--ink-faint)", marginTop: 8 }}>
          {current.refunds > 0 ? `${fmt(current.grossRevenue)} gross − ${fmt(current.refunds)} refunded` : "No refunds this month"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        <KpiTile label="EXPENSES" icon="topay" value={fmt(current.totalExpenses)} sub={`${fmt(current.coachPayouts)} coach payouts`} delta={prev && <Delta pct={pctChange(current.totalExpenses, prev.totalExpenses)} tone="neutral" />} />
        <KpiTile label="PROFIT" icon="insights" value={fmt(current.profit)} sub={margin !== null ? `${margin >= 0 ? "" : "−"}${Math.abs(Math.round(margin))}% margin` : "Margin needs revenue"} delta={prev && <Delta pct={pctChange(current.profit, prev.profit)} tone="good" />} />
      </div>

      <Card title="NET REVENUE VS EXPENSES" sub={`${caption(report.trend.map((m) => m.month))} · BY MONTH · EGP`}>
        <PnlChart trend={report.trend} />
      </Card>

      <Card title="WHERE THE MONEY CAME FROM" sub={`${monthLabel(current.month).toUpperCase()} · EGP`}>
        <ShareBars slices={report.revenueBySource} />
      </Card>

      <Card title="WHERE THE MONEY WENT" sub={`${monthLabel(current.month).toUpperCase()} · EGP`}>
        {report.expensesBySource.length === 0 ? (
          <EmptyState bare icon="insights" title="No expenses this month" body="Coach payouts and whatever you log show up here, largest first." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {report.expensesBySource.map((s) => (
              <button
                key={s.key}
                className="bq-scale"
                onClick={s.key === "coach_payouts" ? onCoachPayouts : undefined}
                disabled={s.key !== "coach_payouts"}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "none", padding: "6px 0", cursor: s.key === "coach_payouts" ? "pointer" : "default", textAlign: "left" }}
              >
                <span className="bq-grow">
                  <div style={{ font: "600 14px var(--font-body)" }}>{s.label}</div>
                  {s.key === "coach_payouts" && (
                    <div style={{ font: "400 11px var(--font-mono)", color: "var(--ink-faint)" }}>
                      {s.paid !== undefined ? `${fmt(s.paid)} paid · ${fmt(Math.max(0, s.amount - s.paid))} still owed · ` : ""}Locked · settled only
                    </div>
                  )}
                </span>
                <span className="tabular" style={{ font: "800 14px var(--font-body)" }}>{fmt(s.amount)}</span>
                {s.key === "coach_payouts" && <Icon name="chevron-right" size={14} style={{ color: "var(--ink-faint)" }} />}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Button fullWidth size="lg" style={{ marginTop: 4, marginBottom: 18 }} onClick={onAddExpense}>
        Add expense
      </Button>
    </>
  );
}

// ---- Expenses ---------------------------------------------------------

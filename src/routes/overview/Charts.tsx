import { EmptyState } from "../../components/EmptyState";
import { useState } from "react";
import { fmt, monthAbbr } from "../../lib/format";
import type { RevenueReport, RevenueSlice } from "../../lib/types";
import { roundedTopBarPath, useMeasuredWidth } from "./helpers";
import { Empty } from "./Cards";

const REV_COLOR = "var(--primary)";

const PAY_COLOR = "var(--accent)";

/** Revenue vs coach payouts per month — one EGP axis, two series side by side
 * with a 2px gap; revenue is direct-labelled, the legend names both. */
export function RevenueChart({ months, revenueOnly = false }: { months: RevenueReport["months"]; revenueOnly?: boolean }) {
  const [ref, W] = useMeasuredWidth(320);
  const H = 210;
  const top = 26;
  const bottom = 172;
  const max = Math.max(...months.map((m) => Math.max(m.revenue, revenueOnly ? 0 : m.payouts)), 1) * 1.15;
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const slot = W / months.length;
  const barW = Math.max(6, Math.min(18, slot / 3));
  const [hover, setHover] = useState<number | null>(null);
  if (months.every((m) => m.revenue === 0 && (revenueOnly || m.payouts === 0))) {
    if (revenueOnly) return <EmptyState bare icon="insights" title="No sales yet" body="Once you sell a plan, this chart fills in month by month." />;
    return <EmptyState bare icon="insights" title="No sales or payouts yet" body="Once the front desk starts selling and coaches log sessions, this chart fills in month by month." />;
  }

  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        {(revenueOnly ? [["Revenue", REV_COLOR]] : [
          ["Revenue", REV_COLOR],
          ["Coach payouts", PAY_COLOR],
        ]).map(([label, color]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, font: "700 var(--fs-caption) var(--font-mono)", letterSpacing: ".04em", color: "var(--ink-muted)" }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "block" }} />
            {label.toUpperCase()}
          </span>
        ))}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }} role="img" aria-label="Revenue and coach payouts by month">
        {[top, (top + bottom) / 2, bottom].map((gy, i) => (
          <line key={i} x1={0} y1={gy} x2={W} y2={gy} stroke="var(--line)" strokeWidth={1} />
        ))}
        {months.map((m, i) => {
          const cx = (i + 0.5) * slot;
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {m.revenue > 0 && <path d={roundedTopBarPath(cx - barW - 1, y(m.revenue), barW, bottom, 4)} fill={REV_COLOR} />}
              {!revenueOnly && m.payouts > 0 && <path d={roundedTopBarPath(cx + 1, y(m.payouts), barW, bottom, 4)} fill={PAY_COLOR} />}
              {m.revenue > 0 && (
                <text x={cx - barW / 2 - 1} y={y(m.revenue) - 8} textAnchor="middle" style={{ font: "800 var(--fs-caption) var(--font-body)", fill: "var(--ink)" }}>
                  {m.revenue >= 1000 ? `${Math.round(m.revenue / 100) / 10}k` : fmt(m.revenue)}
                </text>
              )}
              <text x={cx} y={H - 4} textAnchor="middle" style={{ font: "700 10px var(--font-mono)", letterSpacing: ".06em", fill: "var(--ink-faint)" }}>
                {monthAbbr(m.month).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          style={{
            position: "absolute",
            top: 30,
            left: Math.min(Math.max((hover + 0.5) * slot - 80, 0), W - 160),
            width: 160,
            background: "var(--ink)",
            color: "var(--surface)",
            borderRadius: 12,
            padding: "8px 12px",
            font: "600 var(--fs-small)/1.6 var(--font-mono)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 800 }}>{monthAbbr(months[hover].month)}</div>
          <div>Revenue {fmt(months[hover].revenue)}</div>
          {!revenueOnly && <div>Payouts {fmt(months[hover].payouts)}</div>}
          {!revenueOnly && <div>Profit {fmt(months[hover].profit)}</div>}
        </div>
      )}
    </div>
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
            <div style={{ height: 8, background: "var(--sunken)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary)", borderRadius: "0 4px 4px 0" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

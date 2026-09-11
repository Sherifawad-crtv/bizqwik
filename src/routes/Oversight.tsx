import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { fmt } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { MonthPicker } from "../components/MonthPicker";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { Spinner } from "../components/Spinner";
import { canLog, STATE_LABELS } from "../lib/types";
import type { Rollup, State } from "../lib/types";

const STATE_COLORS: Record<State, string> = {
  logging: "var(--logging-fg)",
  settled: "var(--settled-fg)",
  paid: "var(--paid-fg)",
};

const STATE_ORDER: State[] = ["logging", "settled", "paid"];

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{title}</div>
      {sub && <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>{sub}</div>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function StatusBreakdown({ rows }: { rows: Rollup[] }) {
  const counts = STATE_ORDER.map((s) => ({ state: s, n: rows.filter((r) => r.state === s).length }));
  return (
    <>
      <div style={{ display: "flex", gap: 2, height: 22 }}>
        {counts
          .filter((c) => c.n > 0)
          .map((c) => (
            <div key={c.state} style={{ flex: c.n, minWidth: 4, background: STATE_COLORS[c.state], borderRadius: 4 }} />
          ))}
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 12 }}>
        {counts.map((c) => (
          <div key={c.state} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 6, height: 6, borderRadius: 999, background: STATE_COLORS[c.state], display: "block" }} />
            <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-muted)" }}>
              {STATE_LABELS[c.state].toUpperCase()} · {c.n}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function CoachSessionBars({ rows }: { rows: Rollup[] }) {
  const sorted = rows.slice().sort((a, b) => b.count - a.count);
  const max = Math.max(...sorted.map((r) => r.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map((r) => (
        <div key={r.coachId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 112, flex: "none", font: "600 13px var(--font-body)", color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {r.name}
          </div>
          <div style={{ flex: 1, height: 18, background: "var(--sunken)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(r.count / max) * 100}%`, height: "100%", background: "var(--primary)", borderRadius: "0 4px 4px 0" }} />
          </div>
          <div className="tabular" style={{ width: 24, flex: "none", textAlign: "right", font: "700 13px var(--font-mono)", color: "var(--ink-muted)" }}>
            {r.count}
          </div>
        </div>
      ))}
    </div>
  );
}

function useMeasuredWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, w] as const;
}

const TREND_H = 220;

function TrendChartPlaceholder() {
  return (
    <div style={{ height: TREND_H, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          border: "3px solid var(--primary-tint)",
          borderTopColor: "var(--primary)",
          animation: "bqSpin .7s linear infinite",
        }}
      />
    </div>
  );
}

function TrendChart({ points }: { points: { month: string; label: string; total: number }[] }) {
  const [ref, W] = useMeasuredWidth(320);
  const H = TREND_H;
  const top = 32;
  const bottom = 176;
  const pad = 8;
  const xs = [pad, W / 2, W - pad];
  const max = Math.max(...points.map((p) => p.total), 1) * 1.2;
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const ys = points.map((p) => y(p.total));
  const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const areaPath = `M${xs[0]},${bottom} L${xs[0]},${ys[0]} L${xs[1]},${ys[1]} L${xs[2]},${ys[2]} L${xs[2]},${bottom} Z`;
  const last = points[points.length - 1];

  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
        {[top, (top + bottom) / 2, bottom].map((gy, i) => (
          <line key={i} x1={0} y1={gy} x2={W} y2={gy} stroke="var(--line)" strokeWidth={1} />
        ))}
        <path d={areaPath} fill="var(--primary)" opacity={0.1} />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        <text x={xs[2]} y={top - 8} textAnchor="end" style={{ font: "800 13px var(--font-body)", fill: "var(--ink)" }}>
          {fmt(last.total)}
        </text>
        {points.map((p, i) => (
          <text
            key={p.month}
            x={xs[i]}
            y={H - 4}
            textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            style={{ font: "700 10px var(--font-mono)", letterSpacing: ".06em", fill: "var(--ink-faint)" }}
          >
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function Oversight() {
  const [month, setMonth] = useState(MOCK.CURRENT_MONTH);
  const navigate = useNavigate();
  const { data } = useAsync(() => api.month(month), [month]);
  const { data: trend } = useAsync(async () => {
    const rollups = await Promise.all(MOCK.MONTHS.map((m) => api.month(m)));
    return MOCK.MONTHS.map((m, i) => ({
      month: m,
      label: m === MOCK.CURRENT_MONTH ? "NOW" : m.slice(5),
      total: rollups[i].rows.filter((r) => canLog(r.role)).reduce((s, r) => s + r.total, 0),
    }));
  }, []);
  useSetHeader({ kicker: "DEPARTMENT", title: "Oversight", right: <MonthPicker month={month} onChange={setMonth} /> }, [month]);

  if (!data) return <Spinner />;
  const rows = data.rows.filter((r) => canLog(r.role));
  const closed = rows.filter((r) => r.state !== "logging").length;

  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
    title: r.name,
    meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? "NO TIER"}`,
    state: r.state,
    amount: r.total,
    onClick: () => navigate(`/coaches/${r.coachId}`, { state: { month } }),
  }));

  return (
    <div>
      <MoneyHero
        label="TEAM PAYOUT RUN RATE · EGP"
        value={fmt(rows.reduce((s, r) => s + r.total, 0))}
        stats={[
          { k: "COACHES", v: String(rows.length) },
          { k: "SESSIONS", v: String(rows.reduce((s, r) => s + r.count, 0)) },
          { k: "CLOSED", v: `${closed} of ${rows.length}` },
        ]}
      />

      <Card title="PAYOUT TREND" sub="LAST 3 MONTHS · EGP">
        {trend ? <TrendChart points={trend} /> : <TrendChartPlaceholder />}
      </Card>

      <Card title="SETTLEMENT STATUS" sub="THIS MONTH">
        <StatusBreakdown rows={rows} />
      </Card>

      <Card title="SESSIONS PER COACH" sub="RANKED BY VOLUME · THIS MONTH">
        {rows.length > 0 ? (
          <CoachSessionBars rows={rows} />
        ) : (
          <div style={{ font: "500 13px var(--font-body)", color: "var(--ink-faint)" }}>No sessions logged yet.</div>
        )}
      </Card>

      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "22px 0 10px" }}>
        COACHES · {rows.length}
      </div>
      <RollupTable colA="COACH" colB="ACTIVITY" rows={rowItems} />

      <div style={{ textAlign: "center", font: "400 12px var(--font-mono)", color: "var(--ink-faint)", margin: "18px 0" }}>
        Oversight is read-only — settlement still happens on the coach record.
      </div>
    </div>
  );
}

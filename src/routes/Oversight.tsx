import { EmptyState } from "../components/EmptyState";
import { useSticky } from "../lib/useSticky";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api } from "../lib/backend";
import { fmt, monthAbbr } from "../lib/format";
import type { RevenueReport, RevenueSlice } from "../lib/types";
import { HomeAvatar } from "../components/HomeAvatar";
import { Icon, type IconName } from "../components/Icon";
import { Segmented } from "../components/Segmented";
import { Spinner } from "../components/Spinner";

function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{title}</div>
      {sub && <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>{sub}</div>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <EmptyState bare icon="insights" title={text} body="This fills in automatically as the front desk sells plans, packages and drop-ins." />;
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

/** A bar's outline: rounded top corners (the "data end"), square at the baseline. */
function roundedTopBarPath(x: number, yTop: number, w: number, yBottom: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, yBottom - yTop));
  return [`M${x},${yBottom}`, `L${x},${yTop + rr}`, `Q${x},${yTop} ${x + rr},${yTop}`, `L${x + w - rr},${yTop}`, `Q${x + w},${yTop} ${x + w},${yTop + rr}`, `L${x + w},${yBottom}`, "Z"].join(" ");
}

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
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, font: "700 11px var(--font-mono)", letterSpacing: ".04em", color: "var(--ink-muted)" }}>
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
                <text x={cx - barW / 2 - 1} y={y(m.revenue) - 8} textAnchor="middle" style={{ font: "800 11px var(--font-body)", fill: "var(--ink)" }}>
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
            font: "600 12px/1.6 var(--font-mono)",
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
function ShareBars({ slices }: { slices: RevenueSlice[] }) {
  const total = slices.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) return <Empty text="No sales in this period yet." />;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {slices.map((s) => {
        const pct = (s.amount / total) * 100;
        return (
          <div key={s.key}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
              <span style={{ flex: 1, minWidth: 0, font: "600 14px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
              <span className="tabular" style={{ font: "800 14px var(--font-body)" }}>{fmt(s.amount)}</span>
              <span className="tabular" style={{ width: 40, textAlign: "right", font: "600 12px var(--font-mono)", color: "var(--ink-faint)" }}>{Math.round(pct)}%</span>
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

type Range = "1" | "3" | "6" | "12";
type Breakdown = "service" | "type";

/** Change vs the previous equal period. `tone` says how to colour it: revenue
 * and profit going up is good, payouts going up is just information. */
function Delta({ pct, tone }: { pct: number | null; tone: "good" | "neutral" }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const flat = Math.abs(pct) < 0.05;
  const color = tone === "neutral" || flat ? "var(--ink-muted)" : up ? "var(--paid-fg)" : "var(--danger-fg)";
  const bg = tone === "neutral" || flat ? "var(--sunken)" : up ? "var(--paid-bg)" : "var(--danger-bg)";
  return (
    <span className="tabular" style={{ flex: "none", background: bg, color, borderRadius: 999, padding: "3px 9px", font: "700 11px var(--font-mono)", letterSpacing: ".02em", whiteSpace: "nowrap" }}>
      {flat ? "–" : up ? "▲" : "▼"} {Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : (Math.round(Math.abs(pct) * 10) / 10).toString()}%
    </span>
  );
}

function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

function KpiTile({ label, value, sub, icon, delta }: { label: string; value: string; sub?: string; icon: IconName; delta?: ReactNode }) {
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 16px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 28, height: 28, flex: "none", borderRadius: 8, background: "var(--primary-tint)", color: "var(--primary-pressed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={16} />
        </span>
        <span style={{ marginLeft: "auto" }}>{delta}</span>
      </div>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", marginTop: 10 }}>{label}</div>
      <div className="tabular" style={{ font: "800 24px/1.15 var(--font-body)", letterSpacing: "-.02em", marginTop: 2, overflowWrap: "anywhere" }}>{value}</div>
      {sub && <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--ink-faint)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "1", label: "MONTH" },
  { value: "3", label: "3M" },
  { value: "6", label: "6M" },
  { value: "12", label: "12M" },
];

function caption(months: string[]): string {
  if (months.length === 0) return "";
  const first = months[0];
  const last = months[months.length - 1];
  const year = last.slice(0, 4);
  return months.length === 1 ? `${monthAbbr(last)} ${year}`.toUpperCase() : `${monthAbbr(first)} – ${monthAbbr(last)} ${year}`.toUpperCase();
}

/** The founder's home. Order follows the owner's questions: how much came in
 * (revenue, vs before), what's left after coaches (profit), where the business
 * stands (subscribers, credit owed), how it moved, where it came from. Revenue
 * is counted when a sale happens (any tender except wallet). */
export function Oversight() {
  const { profile } = useAuth();
  const [range, setRange] = useSticky<Range>("range", "1", { valid: (v) => ["1","3","6","12"].includes(v) });
  const [breakdown, setBreakdown] = useSticky<Breakdown>("breakdown", "service", { valid: (v) => v === "service" || v === "type" });
  const { data, error } = useAsync(async () => {
    const n = Number(range);
    // The report for the range, plus a window twice as long: its older half is
    // the period before, which the comparisons and the "how much history do we
    // have" note come from.
    const [now, wide] = await Promise.all([api.revenue(n), api.revenue(24)]);
    const rows = wide.months;
    const first = rows.findIndex((m) => m.revenue > 0 || m.payouts > 0);
    const before = rows.slice(Math.max(0, rows.length - 2 * n), rows.length - n);
    const sum = (k: "revenue" | "payouts") => before.reduce((a, m) => a + m[k], 0);
    const previous = { revenue: sum("revenue"), payouts: sum("payouts"), profit: sum("revenue") - sum("payouts") };
    // The month-by-month chart is the business's whole story so far (up to a
    // year), whatever range the numbers above are showing.
    const trend = first < 0 ? rows.slice(-1) : rows.slice(Math.max(first, rows.length - 12));
    return { report: now, previous, trend, monthsOfData: first < 0 ? 0 : rows.length - first };
  }, [range]);
  useSetHeader({ kicker: "BUSINESS", title: "Overview" }, []);

  if (!profile) return null;

  const n = Number(range);
  const report = data?.report;
  const subs = report?.activeSubscribers;
  // How much history the business really has, and so how much of this view can be real.
  const depth = data ? Math.max(1, data.monthsOfData) : n;
  const shown = report ? report.months.slice(-Math.min(n, depth)) : [];
  const short = data ? depth < n : false;
  const compare = data && depth > n ? data.previous : null;
  const prevLabel = n === 1 ? "last month" : `the ${n} months before`;

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

      {error && (
        <div style={{ marginBottom: 14, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 12px" }}>
        <Segmented value={range} onChange={setRange} options={RANGE_OPTIONS} />
        {data && shown.length > 0 && (
          <span style={{ marginLeft: "auto", font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-faint)", textAlign: "right" }}>{caption(shown.map((m) => m.month))}</span>
        )}
      </div>

      {!data || !report ? (
        <Spinner />
      ) : (
        <>
          {short && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--sunken)", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
              <span style={{ color: "var(--ink-muted)", display: "flex", flex: "none", marginTop: 1 }}>
                <Icon name="insights" size={18} />
              </span>
              <span style={{ font: "500 13px/1.5 var(--font-body)", color: "var(--ink-muted)" }}>
                <b style={{ color: "var(--ink)" }}>{depth === 1 ? "You have 1 month of data." : `You have ${depth} months of data.`}</b>{" "}
                {`That's all this ${n}-month view can show. Trends and comparisons with earlier periods appear as you keep selling and logging sessions.`}
              </span>
            </div>
          )}

          <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "20px 20px 18px", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>REVENUE · EGP</span>
              <span style={{ marginLeft: "auto" }}>{compare && <Delta pct={pctChange(report.totals.revenue, compare.revenue)} tone="good" />}</span>
            </div>
            <div className="tabular" style={{ font: "800 56px/1 var(--font-body)", letterSpacing: "-.03em", margin: "8px 0 0", overflowWrap: "anywhere" }}>{fmt(report.totals.revenue)}</div>
            <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--ink-faint)", marginTop: 8 }}>
              {compare && compare.revenue > 0 ? `vs ${fmt(compare.revenue)} ${prevLabel}` : "New money in from cash and card sales"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
            <KpiTile label="PROFIT" icon="insights" value={fmt(report.totals.profit)} sub="Revenue − coach payouts" delta={compare && <Delta pct={pctChange(report.totals.profit, compare.profit)} tone="good" />} />
            <KpiTile label="COACH PAYOUTS" icon="topay" value={fmt(report.totals.payouts)} sub="Owed to coaches" delta={compare && <Delta pct={pctChange(report.totals.payouts, compare.payouts)} tone="neutral" />} />
            <KpiTile label="ACTIVE SUBSCRIBERS" icon="coaches" value={String(subs?.total ?? 0)} sub={`${subs?.groupPlans ?? 0} group plan · ${subs?.ptPackages ?? 0} PT`} />
            <KpiTile label="WALLET CREDIT" icon="wallet" value={fmt(report.walletLiability)} sub="Unspent, owed to members" />
          </div>

          <Card title="REVENUE VS COACH PAYOUTS" sub={`${caption(data.trend.map((m) => m.month))} · BY MONTH · EGP`}>
            <RevenueChart months={data.trend} />
          </Card>

          <Card title="WHERE THE MONEY CAME FROM" sub={`${caption(shown.map((m) => m.month))} · EGP`}>
            <div style={{ marginBottom: 14 }}>
              <Segmented
                value={breakdown}
                onChange={setBreakdown}
                options={[
                  { value: "service", label: "SERVICE" },
                  { value: "type", label: "TYPE" },
                ]}
              />
            </div>
            <ShareBars slices={breakdown === "service" ? report.byService : report.byType} />
          </Card>

          <Card title="BY COACH" sub="PRIVATE TRAINING SOLD · WHAT THEY EARNED">
            {report.byCoach.length === 0 ? (
              <EmptyState bare icon="coaches" title="No coach activity in this period" body="Coaches appear here once they sell PT or get paid for sessions in these months." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: 8, font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-faint)", paddingBottom: 8 }}>
                  <span>COACH</span>
                  <span style={{ textAlign: "right" }}>PT SOLD</span>
                  <span style={{ textAlign: "right" }}>PAID OUT</span>
                </div>
                {report.byCoach.map((c) => (
                  <div key={c.coachId} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: 8, padding: "10px 0", borderTop: "1px solid var(--line)", alignItems: "baseline" }}>
                    <span style={{ font: "600 14px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span className="tabular" style={{ textAlign: "right", font: "800 14px var(--font-body)" }}>{fmt(c.revenue)}</span>
                    <span className="tabular" style={{ textAlign: "right", font: "600 13px var(--font-mono)", color: "var(--ink-muted)" }}>{fmt(c.payouts)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div style={{ textAlign: "center", font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "8px 0 18px" }}>
            Revenue counts every sale when it happens — cash or card. Wallet top-ups and wallet-paid sales aren't counted twice.
          </div>
        </>
      )}
    </div>
  );
}

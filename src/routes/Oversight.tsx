import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api } from "../lib/backend";
import { fmt, monthAbbr } from "../lib/format";
import type { RevenueReport, RevenueSlice } from "../lib/types";
import { HomeAvatar } from "../components/HomeAvatar";
import { MoneyHero } from "../components/MoneyHero";
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
  return <div style={{ font: "500 13px var(--font-body)", color: "var(--ink-faint)" }}>{text}</div>;
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
const PAY_COLOR = "var(--ink-faint)";

/** Revenue vs coach payouts per month — one EGP axis, two series side by side
 * with a 2px gap; revenue is direct-labelled, the legend names both. */
function RevenueChart({ months }: { months: RevenueReport["months"] }) {
  const [ref, W] = useMeasuredWidth(320);
  const H = 210;
  const top = 26;
  const bottom = 172;
  const max = Math.max(...months.map((m) => Math.max(m.revenue, m.payouts)), 1) * 1.15;
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const slot = W / months.length;
  const barW = Math.max(6, Math.min(18, slot / 3));
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        {[
          ["Revenue", REV_COLOR],
          ["Coach payouts", PAY_COLOR],
        ].map(([label, color]) => (
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
              {m.payouts > 0 && <path d={roundedTopBarPath(cx + 1, y(m.payouts), barW, bottom, 4)} fill={PAY_COLOR} />}
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
          <div>Payouts {fmt(months[hover].payouts)}</div>
          <div>Profit {fmt(months[hover].profit)}</div>
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

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 18px" }}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</div>
      <div className="tabular" style={{ font: "800 28px/1.1 var(--font-body)", letterSpacing: "-.02em", marginTop: 6 }}>{value}</div>
      {sub && <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

type Range = "3" | "6" | "12";

/** The founder's home: what the business is making. Revenue is counted when a
 * sale happens (any tender); profit is revenue minus what coaches are owed. */
export function Oversight() {
  const { profile } = useAuth();
  const [range, setRange] = useState<Range>("6");
  const { data, error } = useAsync(() => api.revenue(Number(range)), [range]);
  useSetHeader({ kicker: "BUSINESS", title: "Overview" }, []);

  if (!profile) return null;

  const thisMonth = data?.months[data.months.length - 1];
  const subs = data?.activeSubscribers;

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

      {error && (
        <div style={{ marginBottom: 14, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>
      )}
      {!data ? (
        <Spinner />
      ) : (
        <>
          <MoneyHero
            label="REVENUE · THIS MONTH · EGP"
            value={fmt(thisMonth?.revenue ?? 0)}
            stats={[
              { k: "PROFIT", v: fmt(thisMonth?.profit ?? 0) },
              { k: "COACH PAYOUTS", v: fmt(thisMonth?.payouts ?? 0) },
              { k: "SUBSCRIBERS", v: String(subs?.total ?? 0) },
            ]}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 2px 12px" }}>
            <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Trends</span>
            <div style={{ marginLeft: "auto" }}>
              <Segmented
                value={range}
                onChange={setRange}
                options={[
                  { value: "3", label: "3M" },
                  { value: "6", label: "6M" },
                  { value: "12", label: "12M" },
                ]}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
            <StatTile label="REVENUE" value={fmt(data.totals.revenue)} sub={`Last ${range} months · EGP`} />
            <StatTile label="PROFIT" value={fmt(data.totals.profit)} sub="Revenue − coach payouts" />
          </div>

          <Card title="REVENUE VS COACH PAYOUTS" sub={`BY MONTH · EGP`}>
            <RevenueChart months={data.months} />
          </Card>

          <Card title="BY SERVICE" sub={`LAST ${range} MONTHS · EGP`}>
            <ShareBars slices={data.byService} />
          </Card>

          <Card title="BY TYPE" sub="MEMBERSHIPS, MONTHLIES, BUNDLES, DROP-INS, PT">
            <ShareBars slices={data.byType} />
          </Card>

          <Card title="BY COACH" sub="PRIVATE TRAINING SOLD · WHAT THEY EARNED">
            {data.byCoach.length === 0 ? (
              <Empty text="No coach activity in this period." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: 8, font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-faint)", paddingBottom: 8 }}>
                  <span>COACH</span>
                  <span style={{ textAlign: "right" }}>PT SOLD</span>
                  <span style={{ textAlign: "right" }}>PAID OUT</span>
                </div>
                {data.byCoach.map((c) => (
                  <div key={c.coachId} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px", gap: 8, padding: "10px 0", borderTop: "1px solid var(--line)", alignItems: "baseline" }}>
                    <span style={{ font: "600 14px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span className="tabular" style={{ textAlign: "right", font: "800 14px var(--font-body)" }}>{fmt(c.revenue)}</span>
                    <span className="tabular" style={{ textAlign: "right", font: "600 13px var(--font-mono)", color: "var(--ink-muted)" }}>{fmt(c.payouts)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 14 }}>
            <StatTile
              label="ACTIVE SUBSCRIBERS"
              value={String(subs?.total ?? 0)}
              sub={`${subs?.groupPlans ?? 0} group plan · ${subs?.ptPackages ?? 0} PT`}
            />
            <StatTile label="WALLET CREDIT OUT" value={fmt(data.walletLiability)} sub="Unspent store credit · EGP" />
          </div>

          <div style={{ textAlign: "center", font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "8px 0 18px" }}>
            Revenue counts every sale when it happens — cash, card or wallet. Wallet top-ups aren't counted twice.
          </div>
        </>
      )}
    </div>
  );
}

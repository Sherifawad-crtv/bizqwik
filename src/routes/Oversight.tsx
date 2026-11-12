import { EmptyState } from "../components/EmptyState";
import { useSticky } from "../lib/useSticky";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api } from "../lib/backend";
import { fmt } from "../lib/format";
import { HomeAvatar } from "../components/HomeAvatar";
import { Icon } from "../components/Icon";
import { Segmented } from "../components/Segmented";
import { Spinner } from "../components/Spinner";
import { caption, pctChange } from "./overview/helpers";
import { RevenueChart, ShareBars } from "./overview/Charts";
import { Card, Delta, KpiTile } from "./overview/Cards";

type Range = "1" | "3" | "6" | "12";

type Breakdown = "service" | "type";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "1", label: "MONTH" },
  { value: "3", label: "3M" },
  { value: "6", label: "6M" },
  { value: "12", label: "12M" },
];

/** The founder's home. Order follows the owner's questions: how much came in
 * (revenue, vs before), what's left after coaches (profit), where the business
 * stands (subscribers, credit owed), how it moved, where it came from. Revenue
 * is counted when a sale happens (any tender except wallet). */
export function Oversight() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [range, setRange] = useSticky<Range>("range", "1", { valid: (v) => ["1","3","6","12"].includes(v) });
  const [breakdown, setBreakdown] = useSticky<Breakdown>("breakdown", "service", { valid: (v) => v === "service" || v === "type" });
  const { data, error } = useAsync(async () => {
    const n = Number(range);
    // The report for the range, plus a window twice as long: its older half is
    // the period before, which the comparisons and the "how much history do we
    // have" note come from.
    const now = await api.revenue(n, 24);
    const rows = now.history ?? now.months;
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
        <div className="bq-rise" style={{ marginBottom: 14, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: "var(--r-md)", padding: "10px 14px" }}>{error}</div>
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
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--sunken)", borderRadius: "var(--r-md)", padding: "12px 14px", marginBottom: 14 }}>
              <span style={{ color: "var(--ink-muted)", display: "flex", flex: "none", marginTop: 1 }}>
                <Icon name="insights" size={18} />
              </span>
              <span style={{ font: "500 13px/1.5 var(--font-body)", color: "var(--ink-muted)" }}>
                <b style={{ color: "var(--ink)" }}>{depth === 1 ? "You have 1 month of data." : `You have ${depth} months of data.`}</b>{" "}
                {`That's all this ${n}-month view can show. Trends and comparisons with earlier periods appear as you keep selling and logging sessions.`}
              </span>
            </div>
          )}

          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "20px 20px 18px", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="bq-label">REVENUE · EGP</span>
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

          {profile.role === "dept_head" && (
            <button
              className="bq-scale"
              onClick={() => navigate("/accounting")}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 18px", marginBottom: 10, cursor: "pointer", textAlign: "left" }}
            >
              <span style={{ width: 32, height: 32, flex: "none", borderRadius: 8, background: "var(--primary-tint)", color: "var(--primary-pressed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="cash" size={16} />
              </span>
              <span style={{ flex: 1, font: "700 15px var(--font-body)" }}>Profit &amp; loss</span>
              <span style={{ color: "var(--ink-faint)", display: "flex" }}>
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          )}

          <div style={{ textAlign: "center", font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "8px 0 18px" }}>
            Revenue counts every sale when it happens — cash or card. Wallet top-ups and wallet-paid sales aren't counted twice.
          </div>
        </>
      )}
    </div>
  );
}

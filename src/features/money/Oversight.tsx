import { EmptyState } from "../../design-system/components/EmptyState";
import { useSticky } from "../../design-system/hooks/useSticky";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/auth";
import { useSetHeader } from "../../shared/screen/header";
import { useAsync } from "../../shared/api/useAsync";
import { api } from "../../shared/api/backend";
import { fmt } from "../../shared/format";
import { HomeAvatar } from "../../shared/components/HomeAvatar";
import { Icon } from "../../design-system/components/Icon";
import { Segmented } from "../../design-system/components/Segmented";
import { Spinner } from "../../design-system/components/Spinner";
import { caption, pctChange } from "../../design-system/components/chartHelpers";
import { RevenueChart, ShareBars } from "../../design-system/components/MoneyCharts";
import { Delta, KpiTile } from "../../design-system/components/KpiTile";
import { SectionCard } from "../../design-system/components/Card";
import { Num } from "../../design-system/components/Num";
import "./Oversight.css";

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
  // The founder (department head) gets the four-tile overview; the accountant's Revenue screen keeps the big card.
  const founder = profile?.role === "dept_head";
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
        <div className="bq-rise bq-money-oversight-text">{error}</div>
      )}

      <div className="bq-money-oversight-row">
        <Segmented value={range} onChange={setRange} options={RANGE_OPTIONS} />
        {data && shown.length > 0 && (
          <span className="bq-money-oversight-label">{caption(shown.map((m) => m.month))}</span>
        )}
      </div>

      {!data || !report ? (
        <Spinner />
      ) : (
        <>
          {short && (
            <div className="bq-money-oversight-row-2">
              <span className="bq-fg-secondary bq-flex bq-flex-none bq-mt-px">
                <Icon name="insights" size={18} />
              </span>
              <span className="bq-money-oversight-text-2">
                <b className="bq-fg-primary">{depth === 1 ? "You have 1 month of data." : `You have ${depth} months of data.`}</b>{" "}
                {`That's all this ${n}-month view can show. Trends and comparisons with earlier periods appear as you keep selling and logging sessions.`}
              </span>
            </div>
          )}

          {founder ? (
            // The founder's overview: four equal tiles, no big revenue card.
            <div className="bq-money-oversight-grid">
              <KpiTile label="PROFIT" icon="insights" value={<Num value={report.totals.profit} />} delta={compare && <Delta pct={pctChange(report.totals.profit, compare.profit)} tone="good" />} />
              <KpiTile label="REVENUE" icon="wallet" value={<Num value={report.totals.revenue} />} delta={compare && <Delta pct={pctChange(report.totals.revenue, compare.revenue)} tone="good" />} />
              <KpiTile label="ACTIVE SUBSCRIBERS" icon="coaches" value={<Num value={subs?.total ?? 0} />} />
              <KpiTile label="COACH PAYOUTS" icon="topay" value={<Num value={report.totals.payouts} />} delta={compare && <Delta pct={pctChange(report.totals.payouts, compare.payouts)} tone="neutral" />} />
            </div>
          ) : (
            <>
            <div className="bq-card bq-money-oversight-spacing">
              <div className="bq-flex bq-items-center bq-gap-2">
                <span className="bq-label">REVENUE · EGP</span>
                <span className="bq-ml-auto">{compare && <Delta pct={pctChange(report.totals.revenue, compare.revenue)} tone="good" />}</span>
              </div>
              <div className="tabular bq-stat-xl bq-money-oversight-part">{fmt(report.totals.revenue)}</div>
              <div className="bq-money-oversight-meta">
                {compare && compare.revenue > 0 ? `vs ${fmt(compare.revenue)} ${prevLabel}` : "New money in from cash and card sales"}
              </div>
            </div>

            <div className="bq-money-oversight-grid">
              <KpiTile label="PROFIT" icon="insights" value={<Num value={report.totals.profit} />} sub="Revenue − coach payouts" delta={compare && <Delta pct={pctChange(report.totals.profit, compare.profit)} tone="good" />} />
              <KpiTile label="COACH PAYOUTS" icon="topay" value={<Num value={report.totals.payouts} />} sub="Owed to coaches" delta={compare && <Delta pct={pctChange(report.totals.payouts, compare.payouts)} tone="neutral" />} />
              <KpiTile label="ACTIVE SUBSCRIBERS" icon="coaches" value={<Num value={subs?.total ?? 0} />} sub={`${subs?.groupPlans ?? 0} group plan · ${subs?.ptPackages ?? 0} PT`} />
              <KpiTile label="WALLET CREDIT" icon="wallet" value={<Num value={report.walletLiability} />} sub="Unspent, owed to members" />
            </div>
            </>
          )}

          <SectionCard title="REVENUE VS COACH PAYOUTS" sub={`${caption(data.trend.map((m) => m.month))} · BY MONTH · EGP`}>
            <RevenueChart months={data.trend} />
          </SectionCard>

          <SectionCard title="WHERE THE MONEY CAME FROM" sub={`${caption(shown.map((m) => m.month))} · EGP`}>
            <div className="bq-mb-4">
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
          </SectionCard>

          <SectionCard title="BY COACH" sub="PRIVATE TRAINING SOLD · WHAT THEY EARNED">
            {report.byCoach.length === 0 ? (
              <EmptyState bare icon="coaches" title="No coach activity in this period" body="Coaches appear here once they sell PT or get paid for sessions in these months." />
            ) : (
              <div className="bq-flex bq-col">
                <div className="bq-money-oversight-label-2">
                  <span>COACH</span>
                  <span className="bq-text-right">PT SOLD</span>
                  <span className="bq-text-right">PAID OUT</span>
                </div>
                {report.byCoach.map((c) => (
                  <div className="bq-money-oversight-grid-2" key={c.coachId}>
                    <span className="bq-money-oversight-text-3">{c.name}</span>
                    <span className="tabular bq-money-oversight-title">{fmt(c.revenue)}</span>
                    <span className="tabular bq-money-oversight-meta-2">{fmt(c.payouts)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {profile.role === "dept_head" && (
            <button
              className="bq-scale bq-card bq-money-oversight-btn"
              onClick={() => navigate("/accounting")}
            >
              <span className="bq-money-oversight-row-3">
                <Icon name="cash" size={16} />
              </span>
              <span className="bq-money-oversight-title-2">Profit &amp; loss</span>
              <span className="bq-fg-tertiary bq-flex">
                <Icon name="chevron-right" size={16} />
              </span>
            </button>
          )}

          <div className="bq-money-oversight-meta-3">
            Revenue counts every sale when it happens — cash or card. Wallet top-ups and wallet-paid sales aren't counted twice.
          </div>
        </>
      )}
    </div>
  );
}

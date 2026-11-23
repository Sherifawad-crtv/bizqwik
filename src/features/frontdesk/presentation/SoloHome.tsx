import { cx } from "../../../design-system/cx";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth";
import { useSetHeader } from "../../../shared/screen/header";
import { useAsync } from "../../../shared/api/useAsync";
import { setSticky } from "../../../design-system/hooks/useSticky";
import { desk, useDeskClients } from "./hooks/useDesk";
import { fmt } from "../../../shared/format";
import { timeLabel, pad } from "../../../shared/classTime";
import { HomeAvatar } from "../../../shared/components/HomeAvatar";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { Icon, type IconName } from "../../../design-system/components/Icon";
import { Spinner } from "../../../design-system/components/Spinner";
import { RevenueChart } from "../../../design-system/components/MoneyCharts";
import { LocationSwitcher, atLocation, useCurrentLocation } from "../../../shared/locations";
import { PaymentRequestsCard } from "./PaymentRequests";
import { SectionLink } from "./shared";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { endingSoon, planSummary } from "../../../shared/deskStatus";
import { useNow } from "../../../shared/useNow";
import "./SoloHome.css";

const clockOf = (iso: string) => {
  const d = new Date(iso);
  return timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
};

function dayOf(iso: string): string {
  const d = new Date(iso);
  const t = new Date();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

type Tone = { fg: string; bg: string };
const TONES: Record<"primary" | "good" | "warn" | "neutral", Tone> = {
  primary: { fg: "var(--color-bg-fill-primary-active)", bg: "var(--color-bg-fill-accent-default)" },
  good: { fg: "var(--color-text-status-paid-default)", bg: "var(--color-bg-fill-status-paid-default)" },
  warn: { fg: "var(--color-text-status-logging-default)", bg: "var(--color-bg-fill-status-logging-default)" },
  neutral: { fg: "var(--color-text-secondary-default)", bg: "var(--color-bg-surface-secondary-default)" },
};

function Stat({ label, value, sub, icon, tone, onClick }: { label: string; value: string; sub: string; icon: IconName; tone: keyof typeof TONES; onClick?: () => void }) {
  return (
    <button
      className="bq-scale bq-card bq-frontdesk-solo-home-stat-btn"
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="bq-flex bq-items-center bq-gap-2">
        <span className="bq-frontdesk-solo-home-stat-row" style={{ background: TONES[tone].bg, color: TONES[tone].fg }}>
          <Icon name={icon} size={17} />
        </span>
        <span className="bq-label">{label}</span>
      </div>
      <div className="bq-stat-lg bq-mt-2 bq-overflow-hidden bq-ellipsis bq-nowrap">{value}</div>
      <div className="bq-frontdesk-solo-home-stat-meta">{sub}</div>
    </button>
  );
}

/** The solo owner's home: how the business is doing, two things she does all
 * day, then what's next and what just happened. */
export function SoloHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  useSetHeader({ kicker: "TODAY", title: "Today" }, []);
  const clients = useDeskClients();
  const revenue = useAsync(() => desk.revenue(12), []);
  const classes = useAsync(() => desk.classes(new Date(Date.now() - 2 * 3600000).toISOString()), []);
  const bundles = useAsync(() => desk.bundleTypes(), []);
  const bundleTypes = useMemo(() => bundles.data?.bundleTypes ?? [], [bundles.data]);
  const { locations, current, ready: locsReady } = useCurrentLocation();
  // Two or more locations: everything on Today is the selected location's.
  const here = locations.length > 1 ? (current?.id ?? null) : null;
  const locRevenue = useAsync(() => (here ? desk.paymentsSummary(12, here) : Promise.resolve(null)), [here]);

  const stats = useMemo(() => {
    const list = (clients.data?.clients ?? []).filter((c) => atLocation(c.homeLocationId, here));
    return {
      total: list.length,
      active: list.filter((c) => planSummary(c, bundleTypes).tone === "active").length,
      soon: list.filter((c) => endingSoon(c) !== null).length,
    };
  }, [clients.data, bundleTypes, here]);

  const months = useMemo(
    () => (here ? (locRevenue.data?.byMonth ?? []).map((m) => ({ month: m.month, revenue: m.revenue, payouts: 0, profit: m.revenue })) : (revenue.data?.months ?? [])),
    [here, locRevenue.data, revenue.data],
  );
  const trend = useMemo(() => {
    const rows = months;
    const first = rows.findIndex((m) => m.revenue > 0);
    return first < 0 ? rows.slice(-1) : rows.slice(Math.max(first, rows.length - 12));
  }, [months]);
  const thisMonth = months.at(-1)?.revenue ?? 0;
  const lastMonth = months.at(-2)?.revenue ?? 0;
  const delta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const now = useNow();
  const nextUp = useMemo(() => {
    // Only what's on at the location she's working at (plus anything untied).
    return (classes.data?.classes ?? [])
      .filter((c) => c.status !== "cancelled" && Date.parse(c.startsAt) + 3600000 >= now)
      .filter((c) => atLocation(c.locationId, here))
      .slice(0, 5);
  }, [classes.data, here, now]);

  const nextUpId = nextUp[0]?.id;
  const goMembers = (filter: string) => {
    setSticky("memberFilter", filter);
    navigate("/members");
  };

  if (!profile) return null;
  if (!locsReady || !clients.data || !revenue.data || (here && !locRevenue.data)) return <Spinner />;

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />
      <LocationSwitcher />
      <PaymentRequestsCard />

      <div className="bq-frontdesk-solo-home-grid">
        <Stat label="REVENUE" icon="cash" tone="primary" value={fmt(thisMonth)} sub={delta === null ? "EGP this month" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% this month`} onClick={() => navigate("/money")} />
        <Stat label="MEMBERS" icon="members" tone="neutral" value={String(stats.total)} sub="All clients" onClick={() => goMembers("all")} />
        <Stat label="ACTIVE" icon="check" tone="good" value={String(stats.active)} sub="On a running plan" onClick={() => goMembers("active")} />
        <Stat label="ENDING SOON" icon="history" tone="warn" value={String(stats.soon)} sub="Next 7 days" onClick={() => goMembers("soon")} />
      </div>

      <Card className="bq-frontdesk-solo-home-card" pad="none">
        <div className="bq-frontdesk-solo-home-label">REVENUE BY MONTH · EGP</div>
        <RevenueChart months={trend} revenueOnly />
      </Card>


      <SectionHeader right={<SectionLink onClick={() => navigate("/bookings")}>Schedule</SectionLink>}>Coming up</SectionHeader>
      <Card className="bq-overflow-hidden bq-mb-6" pad="none">
        {nextUp.map((c, i) => (
          <button
            key={c.id}
            className={cx(`bq-plain bq-scale bq-listrow bq-listrow--compact ${!(i === nextUp.length - 1) ? "bq-listrow--divider" : ""}`, "bq-frontdesk-solo-home-btn")}
            onClick={() => navigate("/bookings")}
          >
            <span className="bq-frontdesk-solo-home-meta">
              <span className="bq-block bq-nowrap">{clockOf(c.startsAt)}</span>
              <span className="bq-frontdesk-solo-home-meta-2">{dayOf(c.startsAt)}</span>
            </span>
            <span className="bq-grow">
              <span className="bq-frontdesk-solo-home-title">{c.title}</span>
              <span className="bq-frontdesk-solo-home-meta-3" style={{ color: (c.bookedCount ?? 0) > 0 ? "var(--color-bg-fill-primary-active)" : "var(--color-text-tertiary-default)" }}>
                {(c.bookedCount ?? 0) > 0 ? `${c.bookedCount} coming` : "No one yet"}
                {c.id === nextUpId ? " · NEXT" : ""}
              </span>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
        {nextUp.length === 0 && <EmptyState bare icon="calendar" title="No classes coming up" body="Add a class on the Schedule tab and your members are reminded before it starts." />}
      </Card>

    </div>
  );
}

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { setSticky } from "../../lib/useSticky";
import { api } from "../../lib/backend";
import { fmt } from "../../lib/format";
import { timeLabel, pad } from "../../lib/classTime";
import { HomeAvatar } from "../../components/HomeAvatar";
import { EmptyState } from "../../components/EmptyState";
import { Icon, type IconName } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { RevenueChart } from "../../components/MoneyCharts";
import { LocationSwitcher, atLocation, useCurrentLocation } from "../../lib/locations";
import { PaymentRequestsCard } from "./PaymentRequests";
import { SectionLink } from "./shared";
import { Card } from "../../components/Card";
import { SectionHeader } from "../../components/SectionHeader";
import { endingSoon, planSummary } from "./deskStatus";
import { useNow } from "../../lib/useNow";

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
      className="bq-scale bq-card"
      onClick={onClick}
      style={{ textAlign: "left", padding: "16px 18px", cursor: onClick ? "pointer" : "default", minWidth: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 32, height: 32, borderRadius: 999, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: TONES[tone].bg, color: TONES[tone].fg }}>
          <Icon name={icon} size={17} />
        </span>
        <span className="bq-label">{label}</span>
      </div>
      <div className="bq-stat-lg" style={{ marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ font: "400 var(--text-caption-1-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", marginTop: 4 }}>{sub}</div>
    </button>
  );
}

/** The solo owner's home: how the business is doing, two things she does all
 * day, then what's next and what just happened. */
export function SoloHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  useSetHeader({ kicker: "TODAY", title: "Today" }, []);
  const clients = useAsync(() => api.clients(), []);
  const revenue = useAsync(() => api.revenue(12), []);
  const classes = useAsync(() => api.classes(new Date(Date.now() - 2 * 3600000).toISOString()), []);
  const bundles = useAsync(() => api.bundleTypes(), []);
  const bundleTypes = useMemo(() => bundles.data?.bundleTypes ?? [], [bundles.data]);
  const { locations, current, ready: locsReady } = useCurrentLocation();
  // Two or more locations: everything on Today is the selected location's.
  const here = locations.length > 1 ? (current?.id ?? null) : null;
  const locRevenue = useAsync(() => (here ? api.paymentsSummary(12, here) : Promise.resolve(null)), [here]);

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stat label="REVENUE" icon="cash" tone="primary" value={fmt(thisMonth)} sub={delta === null ? "EGP this month" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% this month`} onClick={() => navigate("/money")} />
        <Stat label="MEMBERS" icon="members" tone="neutral" value={String(stats.total)} sub="All clients" onClick={() => goMembers("all")} />
        <Stat label="ACTIVE" icon="check" tone="good" value={String(stats.active)} sub="On a running plan" onClick={() => goMembers("active")} />
        <Stat label="ENDING SOON" icon="history" tone="warn" value={String(stats.soon)} sub="Next 7 days" onClick={() => goMembers("soon")} />
      </div>

      <Card pad="none" style={{ padding: "18px 18px 12px", marginTop: 10 }}>
        <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", marginBottom: 10 }}>REVENUE BY MONTH · EGP</div>
        <RevenueChart months={trend} revenueOnly />
      </Card>


      <SectionHeader right={<SectionLink onClick={() => navigate("/bookings")}>Schedule</SectionLink>}>Coming up</SectionHeader>
      <Card pad="none" style={{ overflow: "hidden", marginBottom: 24 }}>
        {nextUp.map((c, i) => (
          <button
            key={c.id}
            className={`bq-plain bq-scale bq-listrow bq-listrow--compact ${!(i === nextUp.length - 1) ? "bq-listrow--divider" : ""}`}
            onClick={() => navigate("/bookings")}
            style={{ width: "100%", minHeight: 60, background: "none", cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ width: 84, flex: "none", font: "700 var(--text-subheadline-size) var(--font-family-mono)" }}>
              <span style={{ display: "block", whiteSpace: "nowrap" }}>{clockOf(c.startsAt)}</span>
              <span style={{ display: "block", font: "400 var(--text-caption-2-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>{dayOf(c.startsAt)}</span>
            </span>
            <span className="bq-grow">
              <span style={{ display: "block", font: "700 var(--text-body-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
              <span style={{ display: "block", font: "400 var(--text-caption-1-size) var(--font-family-mono)", color: (c.bookedCount ?? 0) > 0 ? "var(--color-bg-fill-primary-active)" : "var(--color-text-tertiary-default)" }}>
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

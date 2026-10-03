import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { setSticky } from "../../lib/useSticky";
import { api } from "../../lib/backend";
import { fmt } from "../../lib/format";
import { timeLabel, pad } from "../../lib/classTime";
import type { GymClass } from "../../lib/types";
import { HomeAvatar } from "../../components/HomeAvatar";
import { QuickAction } from "../../components/QuickAction";
import { ClassRosterSheet } from "../../components/ClassRosterSheet";
import { EmptyState } from "../../components/EmptyState";
import { Icon, type IconName } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { Spinner } from "../../components/Spinner";
import { RevenueChart } from "../Oversight";
import { Card, SectionLink, SectionTitle, SheetHeading, endingSoon, planSummary } from "./shared";
import { useFrontDeskCatalog } from "./Members";
import { NewClientModal } from "./NewClientModal";
import { DropIn } from "./DropIn";
import { CheckInList } from "./CheckInList";

const clockOf = (iso: string) => {
  const d = new Date(iso);
  return timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

type Tone = { fg: string; bg: string };
const TONES: Record<"primary" | "good" | "warn" | "neutral", Tone> = {
  primary: { fg: "var(--primary-pressed)", bg: "var(--primary-tint)" },
  good: { fg: "var(--paid-fg)", bg: "var(--paid-bg)" },
  warn: { fg: "var(--logging-fg)", bg: "var(--logging-bg)" },
  neutral: { fg: "var(--ink-muted)", bg: "var(--sunken)" },
};

function Stat({ label, value, sub, icon, tone, onClick }: { label: string; value: string; sub: string; icon: IconName; tone: keyof typeof TONES; onClick?: () => void }) {
  return (
    <button
      data-sq
      data-tap
      onClick={onClick}
      style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 18px", cursor: onClick ? "pointer" : "default", minWidth: 0 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 32, height: 32, borderRadius: 999, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: TONES[tone].bg, color: TONES[tone].fg }}>
          <Icon name={icon} size={17} />
        </span>
        <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</span>
      </div>
      <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em", marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
      <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-muted)", marginTop: 4 }}>{sub}</div>
    </button>
  );
}

/** The solo owner's home: how the business is doing, two things she does all
 * day, then what's next and what just happened. */
export function SoloHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  useSetHeader({ kicker: "TODAY", title: "Today" }, []);
  const summary = useAsync(() => api.frontDeskSummary(), []);
  const clients = useAsync(() => api.clients(), []);
  const revenue = useAsync(() => api.revenue(12), []);
  const classes = useAsync(() => api.classes(new Date(Date.now() - 2 * 3600000).toISOString()), []);
  const { bundleTypes, planTypes: allPlans } = useFrontDeskCatalog();
  const planTypes = allPlans.filter((p) => p.kind === "membership" && p.active);
  const [modal, setModal] = useState<"new" | "dropin" | "checkin" | null>(null);
  const [roster, setRoster] = useState<GymClass | null>(null);

  const stats = useMemo(() => {
    const list = clients.data?.clients ?? [];
    return {
      total: list.length,
      active: list.filter((c) => planSummary(c, bundleTypes).tone === "active").length,
      soon: list.filter((c) => endingSoon(c) !== null).length,
    };
  }, [clients.data, bundleTypes]);

  const trend = useMemo(() => {
    const rows = revenue.data?.months ?? [];
    const first = rows.findIndex((m) => m.revenue > 0);
    return first < 0 ? rows.slice(-1) : rows.slice(Math.max(first, rows.length - 12));
  }, [revenue.data]);
  const thisMonth = revenue.data?.months.at(-1)?.revenue ?? 0;
  const lastMonth = revenue.data?.months.at(-2)?.revenue ?? 0;
  const delta = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const nextUp = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return (classes.data?.classes ?? []).filter((c) => c.status !== "cancelled" && Date.parse(c.startsAt) + 3600000 >= Date.now() && Date.parse(c.startsAt) <= end.getTime()).slice(0, 3);
  }, [classes.data]);

  const goMembers = (filter: string) => {
    setSticky("memberFilter", filter);
    navigate("/members");
  };

  if (!profile) return null;
  if (!summary.data || !clients.data || !revenue.data) return <Spinner />;
  const recent = summary.data.recent;

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Stat label="REVENUE" icon="cash" tone="primary" value={fmt(thisMonth)} sub={delta === null ? "EGP this month" : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% this month`} onClick={() => navigate("/money")} />
        <Stat label="MEMBERS" icon="account" tone="neutral" value={String(stats.total)} sub="All clients" onClick={() => goMembers("all")} />
        <Stat label="ACTIVE" icon="check" tone="good" value={String(stats.active)} sub="On a running plan" onClick={() => goMembers("active")} />
        <Stat label="ENDING SOON" icon="history" tone="warn" value={String(stats.soon)} sub="Next 7 days" onClick={() => goMembers("soon")} />
      </div>

      <Card style={{ padding: "18px 18px 12px", marginTop: 10 }}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", marginBottom: 10 }}>REVENUE BY MONTH · EGP</div>
        <RevenueChart months={trend} revenueOnly />
      </Card>

      <div role="group" aria-label="Quick actions" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", justifyItems: "center", margin: "24px 0 4px", maxWidth: 360, marginInline: "auto" }}>
        <QuickAction icon="user-plus" label="New client" onClick={() => setModal("new")} />
        <QuickAction icon="ticket" label="Drop-in" onClick={() => setModal("dropin")} />
        <QuickAction icon="check" label="Check in" onClick={() => setModal("checkin")} />
      </div>

      <SectionTitle right={<SectionLink onClick={() => navigate("/bookings")}>All bookings</SectionLink>}>Next up</SectionTitle>
      <Card style={{ overflow: "hidden", marginBottom: 24 }}>
        {nextUp.map((c, i) => (
          <button
            key={c.id}
            data-tap
            onClick={() => setRoster(c)}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 60, padding: "12px 18px", border: 0, borderBottom: i === nextUp.length - 1 ? "none" : "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ width: 84, flex: "none", whiteSpace: "nowrap", font: "700 14px var(--font-mono)" }}>{clockOf(c.startsAt)}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
              <span style={{ display: "block", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{(c.bookedCount ?? 0) === 0 ? "No one booked" : `${c.bookedCount} booked`}</span>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
        {nextUp.length === 0 && <EmptyState bare icon="calendar" title="No more classes today" body="Upcoming classes show up here." />}
      </Card>

      <SectionTitle right={<SectionLink onClick={() => navigate("/catalog")}>{planTypes.length === 0 ? "Add plan" : "Manage"}</SectionLink>}>Your plans</SectionTitle>
      <Card style={{ overflow: "hidden", marginBottom: 24 }}>
        {planTypes.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: i === planTypes.length - 1 ? "none" : "1px solid var(--line)" }}>
            <span style={{ minWidth: 0, flex: 1, font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{fmt(p.price)} EGP · {p.durationMonths} mo</span>
          </div>
        ))}
        {planTypes.length === 0 && <EmptyState bare icon="tag" title="No plans yet" body="Add your 1-month and 3-month plans to start signing members up." action={{ label: "+ New plan", onClick: () => navigate("/catalog") }} />}
      </Card>

      <SectionTitle right={<SectionLink onClick={() => navigate("/activity")}>Full activity &amp; logs</SectionLink>}>Recent activity</SectionTitle>
      <Card style={{ overflow: "hidden" }}>
        {recent.slice(0, 5).map((r, i, arr) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line)" }}>
            <span style={{ width: 36, height: 36, borderRadius: 999, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: r.kind === "check_in" ? "var(--paid-bg)" : "var(--primary-tint)", color: r.kind === "check_in" ? "var(--paid-fg)" : "var(--primary-pressed)" }}>
              <Icon name={r.kind === "check_in" ? "check" : "ticket"} size={18} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{r.detail}</div>
            </div>
            <span style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{timeAgo(r.at)}</span>
          </div>
        ))}
        {recent.length === 0 && <EmptyState bare icon="inbox" title="Nothing yet today" body="Check-ins and drop-ins show up here as they happen." />}
      </Card>

      <Sheet open={modal === "checkin"} onClose={() => setModal(null)}>
        <SheetHeading kicker="NO SCAN?" title="Check in" />
        <CheckInList />
      </Sheet>
      <Sheet open={modal === "dropin"} onClose={() => setModal(null)}>
        <SheetHeading kicker="DROP-IN" title="Drop-In" />
        <DropIn embedded initialClient={null} />
      </Sheet>
      {modal === "new" && <NewClientModal onClose={() => setModal(null)} />}
      <ClassRosterSheet open={roster !== null} onClose={() => setRoster(null)} classId={roster?.id ?? null} title={roster?.title ?? "Class"} onChanged={classes.refetch} />
    </div>
  );
}

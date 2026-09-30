import { useMemo, useState } from "react";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { useSetHeader } from "../../lib/header";
import { timeLabel, pad } from "../../lib/classTime";
import type { GymClass } from "../../lib/types";
import { Segmented } from "../../components/Segmented";
import { Spinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { ClassRosterSheet } from "../../components/ClassRosterSheet";
import { Card } from "./shared";
import { ClassCalendarScreen } from "./ClassCalendar";

type Range = "today" | "tomorrow" | "week";

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const clock = (iso: string) => {
  const d = new Date(iso);
  return timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
};
const dayHeading = (d: Date, today: Date) => {
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
};

/** What's booked, in the order the desk needs it: what's on now and next first,
 * with the rest of today's finished classes tucked away. */
export function Bookings() {
  useSetHeader({ kicker: "FRONT DESK", title: "Bookings" }, []);
  const [range, setRange] = useState<Range>("today");
  const [open, setOpen] = useState<GymClass | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [month, setMonth] = useState(false);
  const classes = useAsync(() => api.classes(startOfDay(new Date()).toISOString()), []);

  const { groups, earlier } = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(new Date());
    const last = range === "today" ? 1 : range === "tomorrow" ? 2 : 7;
    const first = range === "tomorrow" ? 1 : 0;
    const from = addDays(today, first).getTime();
    const to = addDays(today, last).getTime();
    const live = (classes.data?.classes ?? []).filter((c) => c.status !== "cancelled" && Date.parse(c.startsAt) >= from && Date.parse(c.startsAt) < to);
    const isPast = (c: GymClass) => Date.parse(c.startsAt) + 60 * 60000 < now;
    const upcoming = live.filter((c) => !isPast(c));
    const map = new Map<string, { day: Date; items: GymClass[] }>();
    for (const c of upcoming) {
      const d = startOfDay(new Date(c.startsAt));
      const k = d.toISOString();
      if (!map.has(k)) map.set(k, { day: d, items: [] });
      map.get(k)!.items.push(c);
    }
    return { groups: [...map.values()], earlier: live.filter(isPast) };
  }, [classes.data, range]);

  if (month) return <ClassCalendarScreen onClose={() => setMonth(false)} />;
  if (!classes.data) return <Spinner />;

  const today = startOfDay(new Date());
  const nowMs = Date.now();
  const nextId = groups[0]?.items.find((c) => Date.parse(c.startsAt) + 60 * 60000 >= nowMs)?.id;

  const row = (c: GymClass, muted = false) => {
    const start = Date.parse(c.startsAt);
    const happening = start <= nowMs && nowMs < start + 60 * 60000;
    const booked = c.bookedCount ?? 0;
    return (
      <button
        key={c.id}
        onClick={() => setOpen(c)}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", border: 0, borderBottom: "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left", opacity: muted ? 0.65 : 1 }}
      >
        <span style={{ width: 64, flex: "none", font: "700 14px var(--font-mono)", color: happening ? "var(--primary-pressed)" : "var(--ink)" }}>{clock(c.startsAt)}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
          <span style={{ display: "block", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
            {booked === 0 ? "No one booked" : `${booked} booked`}
            {(c.dropInSeats ?? 0) > 0 ? ` · ${c.dropInSeats} pay per class` : ""}
          </span>
        </span>
        {happening && <span style={{ font: "700 11px var(--font-mono)", color: "var(--paid-fg)", background: "var(--paid-bg)", padding: "3px 8px", borderRadius: 999 }}>NOW</span>}
        {!happening && c.id === nextId && <span style={{ font: "700 11px var(--font-mono)", color: "var(--primary-pressed)", background: "var(--primary-tint)", padding: "3px 8px", borderRadius: 999 }}>NEXT</span>}
        <Icon name="chevron-right" size={16} />
      </button>
    );
  };

  return (
    <div>
      <Segmented
        value={range}
        onChange={(v) => setRange(v as Range)}
        options={[
          { value: "today", label: "Today" },
          { value: "tomorrow", label: "Tomorrow" },
          { value: "week", label: "This week" },
        ]}
      />

      {groups.length === 0 && earlier.length === 0 && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <EmptyState bare icon="calendar" title={range === "today" ? "Nothing booked for the rest of today" : "No classes in this range"} body="Classes appear here as soon as they're scheduled." />
          </Card>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.day.toISOString()} style={{ marginTop: 20 }}>
          <div style={{ font: "700 12px var(--font-mono)", letterSpacing: 1, color: "var(--ink-faint)", textTransform: "uppercase", margin: "0 4px 8px" }}>{dayHeading(g.day, today)}</div>
          <Card style={{ overflow: "hidden" }}>{g.items.map((c) => row(c))}</Card>
        </div>
      ))}

      {earlier.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowEarlier((v) => !v)}
            style={{ border: 0, background: "none", cursor: "pointer", font: "700 14px var(--font-body)", color: "var(--primary-pressed)", padding: "4px 0" }}
          >
            {showEarlier ? "Hide" : "Show"} earlier today ({earlier.length})
          </button>
          {showEarlier && <Card style={{ overflow: "hidden", marginTop: 8 }}>{earlier.map((c) => row(c, true))}</Card>}
        </div>
      )}

      <button
        onClick={() => setMonth(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--primary-pressed)", cursor: "pointer", font: "700 14px var(--font-body)", marginTop: 16, padding: "4px 0" }}
      >
        Open full calendar <Icon name="chevron-right" size={16} />
      </button>

      <ClassRosterSheet open={open !== null} onClose={() => setOpen(null)} classId={open?.id ?? null} title={open?.title ?? "Class"} onChanged={classes.refetch} />
    </div>
  );
}

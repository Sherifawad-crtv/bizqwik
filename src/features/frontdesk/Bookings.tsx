import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { api } from "../../shared/api/backend";
import { useAuth } from "../../shared/auth";
import { LocationSwitcher, useCurrentLocation } from "../../shared/locations";
import { isSoloOwner } from "../../shared/screen/nav";
import { ConfirmSheet } from "../../design-system/components/ConfirmSheet";
import { ClassSheet } from "../../shared/components/ClassSheet";
import { emptyForm, formOf, type FormState } from "../../shared/classForm";
import { SeriesSheet } from "../../shared/components/SeriesSheet";
import { useAsync } from "../../shared/api/useAsync";
import { useSetHeader } from "../../shared/screen/header";
import { timeLabel, pad } from "../../shared/classTime";
import type { GymClass } from "../../shared/types";
import { Segmented } from "../../design-system/components/Segmented";
import { Spinner } from "../../design-system/components/Spinner";
import { EmptyState } from "../../design-system/components/EmptyState";
import { Icon } from "../../design-system/components/Icon";
import { ClassRosterSheet } from "../../shared/components/ClassRosterSheet";
import { SectionLink } from "./shared";
import { Card } from "../../design-system/components/Card";
import { ClassCalendarScreen } from "./ClassCalendar";
import { useNow } from "../../shared/useNow";

type Range = "today" | "tomorrow" | "week" | "all";

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
  const { profile, orgMode } = useAuth();
  const solo = !!profile && isSoloOwner(profile.role, orgMode);
  useSetHeader(solo ? { kicker: "SESSIONS", title: "Schedule" } : { kicker: "FRONT DESK", title: "Bookings" }, [solo]);
  const [form, setForm] = useState<FormState | null>(null);
  // Add class = the same recurring-class flow as the owner's catalog (pick days, time, length).
  const [addingClass, setAddingClass] = useState(false);
  const isMobile = useIsMobile();
  const { locations, current, ready: locsReady } = useCurrentLocation();
  // The selected location's sessions only (each location is run separately).
  const place = locations.length > 1 ? (current?.id ?? "all") : "all";
  const [cancelling, setCancelling] = useState<GymClass | null>(null);
  const [range, setRange] = useState<Range>("today");
  const [open, setOpen] = useState<GymClass | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [month, setMonth] = useState(false);
  const classes = useAsync(() => api.classes(startOfDay(new Date()).toISOString()), []);
  const nowMs = useNow();

  const { groups, earlier, ahead } = useMemo(() => {
    const now = nowMs;
    const today = startOfDay(new Date(nowMs));
    const last = range === "today" ? 1 : range === "tomorrow" ? 2 : range === "week" ? 7 : 366;
    const first = range === "tomorrow" ? 1 : 0;
    const from = addDays(today, first).getTime();
    const to = addDays(today, last).getTime();
    const live = (classes.data?.classes ?? []).filter((c) => c.status !== "cancelled" && Date.parse(c.startsAt) >= from && Date.parse(c.startsAt) < to && (place === "all" || !c.locationId || c.locationId === place));
    const isPast = (c: GymClass) => Date.parse(c.startsAt) + 60 * 60000 < now;
    const upcoming = live.filter((c) => !isPast(c));
    const map = new Map<string, { day: Date; items: GymClass[] }>();
    for (const c of upcoming) {
      const d = startOfDay(new Date(c.startsAt));
      const k = d.toISOString();
      if (!map.has(k)) map.set(k, { day: d, items: [] });
      map.get(k)!.items.push(c);
    }
    // Today is over: show the next day that has classes, so the desk sees
    // what's coming instead of an empty page.
    let ahead: { day: Date; items: GymClass[] } | null = null;
    if (range === "today" && upcoming.length === 0) {
      const later = (classes.data?.classes ?? [])
        .filter((c) => c.status !== "cancelled" && Date.parse(c.startsAt) >= to && (place === "all" || !c.locationId || c.locationId === place))
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
      if (later.length) {
        const day = startOfDay(new Date(later[0].startsAt));
        ahead = { day, items: later.filter((c) => startOfDay(new Date(c.startsAt)).getTime() === day.getTime()) };
      }
    }
    return { groups: [...map.values()], earlier: live.filter(isPast), ahead };
  }, [classes.data, range, place, nowMs]);

  if (month) return <ClassCalendarScreen onClose={() => setMonth(false)} />;
  if (!locsReady || !classes.data) return <Spinner />;

  const today = startOfDay(new Date(nowMs));
  const nextId = groups[0]?.items.find((c) => Date.parse(c.startsAt) + 60 * 60000 >= nowMs)?.id;

  const row = (c: GymClass, muted = false) => {
    const start = Date.parse(c.startsAt);
    const happening = start <= nowMs && nowMs < start + 60 * 60000;
    const booked = c.bookedCount ?? 0;
    return (
      <div key={c.id} style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--color-border-primary-default)", opacity: muted ? 0.65 : 1 }}>
      <button
        onClick={() => (solo ? setForm(formOf(c)) : setOpen(c))}
        style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, padding: "14px 18px", border: 0, background: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ width: 84, flex: "none", whiteSpace: "nowrap", font: "700 var(--text-subheadline-size) var(--font-family-mono)", color: happening ? "var(--color-bg-fill-primary-active)" : "var(--color-text-primary-default)" }}>{clock(c.startsAt)}</span>
        <span className="bq-grow">
          <span style={{ display: "block", font: "700 var(--text-body-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
          {solo ? (
            <span style={{ display: "block", font: "400 var(--text-footnote-size) var(--font-family-mono)", color: booked > 0 ? "var(--color-bg-fill-primary-active)" : "var(--color-text-tertiary-default)" }}>
              {booked === 0 ? "No one yet" : `${booked} coming`}
            </span>
          ) : (
            <span style={{ display: "block", font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>
              {booked === 0 ? "No one booked" : `${booked} booked`}
              {(c.dropInSeats ?? 0) > 0 ? ` · ${c.dropInSeats} pay per class` : ""}
            </span>
          )}
        </span>
        {happening && <span style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", color: "var(--color-text-status-paid-default)", background: "var(--color-bg-fill-status-paid-default)", padding: "3px 8px", borderRadius: 999 }}>NOW</span>}
        {!happening && c.id === nextId && <span style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", color: "var(--color-bg-fill-primary-active)", background: "var(--color-bg-fill-accent-default)", padding: "3px 8px", borderRadius: 999 }}>NEXT</span>}
        <Icon name="chevron-right" size={16} />
      </button>
      </div>
    );
  };

  return (
    <div>
      <LocationSwitcher />
      {solo && (
        <AddClassPills
          hidden={form !== null || addingClass || cancelling !== null}
          floating={isMobile}
          onOne={() => setForm({ ...emptyForm(), locationId: place !== "all" ? place : (current?.id ?? null) })}
          onRecurring={() => setAddingClass(true)}
        />
      )}
      <div style={{ display: "flex", justifyContent: "center" }}>
      <Segmented
        value={range}
        onChange={(v) => setRange(v as Range)}
        options={[
          { value: "today", label: "Today" },
          { value: "tomorrow", label: "Tomorrow" },
          { value: "week", label: "This week" },
          ...(solo ? [{ value: "all", label: "All" }] : []),
        ]}
      />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
        <SectionLink onClick={() => setMonth(true)}>Open full calendar</SectionLink>
      </div>

      {ahead && (
        <div style={{ marginTop: 16 }} data-testid="next-day">
          <Card pad="none">
            <EmptyState bare icon="calendar" title="Nothing left today" body={`Here's what's next — ${dayHeading(ahead.day, today).toLowerCase() === "tomorrow" ? "tomorrow" : dayHeading(ahead.day, today)}.`} />
          </Card>
          <div style={{ font: "700 var(--text-caption-1-size) var(--font-family-mono)", letterSpacing: 1, color: "var(--color-text-tertiary-default)", textTransform: "uppercase", margin: "20px 4px 8px" }}>{dayHeading(ahead.day, today)}</div>
          <Card pad="none" style={{ overflow: "hidden" }}>{ahead.items.map((c) => row(c))}</Card>
        </div>
      )}

      {groups.length === 0 && earlier.length === 0 && !ahead && (
        <div style={{ marginTop: 16 }}>
          <Card pad="none">
            <EmptyState bare icon="calendar" title={range === "today" ? (solo ? "No more classes today" : "Nothing booked for the rest of today") : "No classes in this range"} body={solo ? "Add a class and your members are reminded before it starts." : "Classes appear here as soon as they're scheduled."} />
          </Card>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.day.toISOString()} style={{ marginTop: 20 }}>
          <div style={{ font: "700 var(--text-caption-1-size) var(--font-family-mono)", letterSpacing: 1, color: "var(--color-text-tertiary-default)", textTransform: "uppercase", margin: "0 4px 8px" }}>{dayHeading(g.day, today)}</div>
          <Card pad="none" style={{ overflow: "hidden" }}>{g.items.map((c) => row(c))}</Card>
        </div>
      ))}

      {earlier.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowEarlier((v) => !v)}
            style={{ border: 0, background: "none", cursor: "pointer", font: "700 var(--text-subheadline-size) var(--font-family-body)", color: "var(--color-bg-fill-primary-active)", padding: "4px 0" }}
          >
            {showEarlier ? "Hide" : "Show"} earlier today ({earlier.length})
          </button>
          {showEarlier && <Card pad="none" style={{ overflow: "hidden", marginTop: 8 }}>{earlier.map((c) => row(c, true))}</Card>}
        </div>
      )}

      {solo && isMobile && <div aria-hidden style={{ height: 84 }} />}
      {solo && (
        <>
          <SeriesSheet open={addingClass} series={null} onClose={() => setAddingClass(false)} />
          <ClassSheet solo form={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); classes.refetch(); }} onRequestCancel={(c) => { setForm(null); setCancelling(c); }} />
          <ConfirmSheet
            open={cancelling !== null}
            onClose={() => setCancelling(null)}
            kicker="SESSION"
            title={`Cancel ${cancelling?.title ?? "session"}?`}
            sub="Anyone who booked is refunded automatically. This can't be undone."
            confirmLabel="Cancel session"
            danger
            onConfirm={async () => {
              if (cancelling) await api.cancelClass(cancelling.id);
              setCancelling(null);
              classes.refetch();
            }}
          />
        </>
      )}
      {!solo && <ClassRosterSheet open={open !== null} onClose={() => setOpen(null)} classId={open?.id ?? null} title={open?.title ?? "Class"} onChanged={classes.refetch} />}
    </div>
  );
}

/** "One Class" / "Recurring Schedule". On a phone they float just above the
 * bottom bar, within thumb reach; on a desktop they sit at the top of the list. */
function AddClassPills({ floating, hidden, onOne, onRecurring }: { floating: boolean; hidden: boolean; onOne: () => void; onRecurring: () => void }) {
  const pill: React.CSSProperties = { flex: 1, height: 52, padding: "0 18px", border: 0, borderRadius: 999, cursor: "pointer", font: "700 var(--text-body-size) var(--font-family-body)", whiteSpace: "nowrap" };
  const group = (
    <div
      role="group"
      aria-label="Add a class"
      style={{
        display: "flex",
        gap: 8,
        padding: 6,
        borderRadius: 999,
        background: "var(--color-bg-surface-primary-default)",
        border: "1px solid var(--color-border-primary-default)",
        boxShadow: floating ? "var(--shadow-lifted)" : "none",
        ...(floating ? { width: "min(100% - 32px, 420px)", pointerEvents: "auto" as const } : { marginBottom: 14 }),
      }}
    >
      <button className="bq-scale" onClick={onOne} style={{ ...pill, background: "var(--color-bg-fill-accent-default)", color: "var(--color-bg-fill-primary-active)" }}>One Class</button>
      <button className="bq-scale" onClick={onRecurring} style={{ ...pill, background: "var(--color-bg-fill-primary-default)", color: "var(--color-bg-surface-primary-default)" }}>Recurring Schedule</button>
    </div>
  );
  if (!floating) return group;
  // Out of the way while a sheet is open.
  if (hidden) return null;
  // Above the bottom bar (a 64px bar + its gap above the home indicator).
  return createPortal(
    <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(80px + var(--bar-bottom))", zIndex: 54, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      {group}
    </div>,
    document.body,
  );
}

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "../../../design-system/hooks/useIsMobile";
import { cancelClass, useTodaysClasses } from "./hooks/useSchedule";
import { bookingsView, dayHeading, isHappening, type Range } from "../domain/schedule";
import { startOfDay } from "../domain/calendar";
import { useAuth } from "../../../shared/session/auth";
import { LocationSwitcher, useCurrentLocation } from "../../../shared/session/locations";
import { isSoloOwner } from "../../../shared/screen/nav";
import { ConfirmSheet } from "../../../design-system/components/ConfirmSheet";
import { ClassSheet } from "../../../shared/classes/ClassSheet";
import { emptyForm, formOf, type FormState } from "../../../shared/classes/classForm";
import { SeriesSheet } from "../../../shared/classes/SeriesSheet";
import { useSetHeader } from "../../../shared/screen/header";
import { timeLabel, pad } from "../../../shared/classes/classTime";
import type { GymClass } from "../../../shared/types";
import { Segmented } from "../../../design-system/components/Segmented";
import { Spinner } from "../../../design-system/components/Spinner";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { Icon } from "../../../design-system/components/Icon";
import { ClassRosterSheet } from "../../../shared/classes/ClassRosterSheet";
import { SectionLink } from "./shared";
import { Card } from "../../../design-system/components/Card";
import { ClassCalendarScreen } from "./ClassCalendar";
import { useNow } from "../../../shared/hooks/useNow";
import "./Bookings.css";

const clock = (iso: string) => {
  const d = new Date(iso);
  return timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
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
  const classes = useTodaysClasses();
  const nowMs = useNow();

  const { groups, earlier, ahead } = useMemo(() => bookingsView(classes.data?.classes ?? [], range, place, nowMs), [classes.data, range, place, nowMs]);

  if (month) return <ClassCalendarScreen onClose={() => setMonth(false)} />;
  if (!locsReady || !classes.data) return <Spinner />;

  const today = startOfDay(new Date(nowMs));
  const nextId = groups[0]?.items.find((c) => Date.parse(c.startsAt) + 60 * 60000 >= nowMs)?.id;

  const row = (c: GymClass, muted = false) => {
    const happening = isHappening(c, nowMs);
    const booked = c.bookedCount ?? 0;
    return (
      <div className="bq-frontdesk-bookings-row" key={c.id} style={{ opacity: muted ? 0.65 : 1 }}>
      <button className="bq-frontdesk-bookings-row-btn"
        onClick={() => (solo ? setForm(formOf(c)) : setOpen(c))}
      >
        <span className="bq-frontdesk-bookings-row-meta" style={{ color: happening ? "var(--color-bg-fill-primary-active)" : "var(--color-text-primary-default)" }}>{clock(c.startsAt)}</span>
        <span className="bq-grow">
          <span className="bq-frontdesk-bookings-row-title">{c.title}</span>
          {solo ? (
            <span className="bq-frontdesk-bookings-row-meta-2" style={{ color: booked > 0 ? "var(--color-bg-fill-primary-active)" : "var(--color-text-tertiary-default)" }}>
              {booked === 0 ? "No one yet" : `${booked} coming`}
            </span>
          ) : (
            <span className="bq-frontdesk-bookings-row-meta-3">
              {booked === 0 ? "No one booked" : `${booked} booked`}
              {(c.dropInSeats ?? 0) > 0 ? ` · ${c.dropInSeats} pay per class` : ""}
            </span>
          )}
        </span>
        {happening && <span className="bq-frontdesk-bookings-row-meta-4">NOW</span>}
        {!happening && c.id === nextId && <span className="bq-frontdesk-bookings-row-meta-5">NEXT</span>}
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
      <div className="bq-flex bq-justify-center">
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

      <div className="bq-flex bq-justify-end bq-mt-1-5">
        <SectionLink onClick={() => setMonth(true)}>Open full calendar</SectionLink>
      </div>

      {ahead && (
        <div className="bq-mt-4" data-testid="next-day">
          <Card pad="none">
            <EmptyState bare icon="calendar" title="Nothing left today" body={`Here's what's next — ${dayHeading(ahead.day, today).toLowerCase() === "tomorrow" ? "tomorrow" : dayHeading(ahead.day, today)}.`} />
          </Card>
          <div className="bq-frontdesk-bookings-label">{dayHeading(ahead.day, today)}</div>
          <Card className="bq-overflow-hidden" pad="none">{ahead.items.map((c) => row(c))}</Card>
        </div>
      )}

      {groups.length === 0 && earlier.length === 0 && !ahead && (
        <div className="bq-mt-4">
          <Card pad="none">
            <EmptyState bare icon="calendar" title={range === "today" ? (solo ? "No more classes today" : "Nothing booked for the rest of today") : "No classes in this range"} body={solo ? "Add a class and your members are reminded before it starts." : "Classes appear here as soon as they're scheduled."} />
          </Card>
        </div>
      )}

      {groups.map((g) => (
        <div className="bq-mt-5" key={g.day.toISOString()}>
          <div className="bq-frontdesk-bookings-label-2">{dayHeading(g.day, today)}</div>
          <Card className="bq-overflow-hidden" pad="none">{g.items.map((c) => row(c))}</Card>
        </div>
      ))}

      {earlier.length > 0 && (
        <div className="bq-mt-5">
          <button className="bq-frontdesk-bookings-btn"
            onClick={() => setShowEarlier((v) => !v)}
          >
            {showEarlier ? "Hide" : "Show"} earlier today ({earlier.length})
          </button>
          {showEarlier && <Card className="bq-overflow-hidden bq-mt-2" pad="none">{earlier.map((c) => row(c, true))}</Card>}
        </div>
      )}

      {solo && isMobile && <div className="bq-frontdesk-bookings-size" aria-hidden />}
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
              if (cancelling) await cancelClass(cancelling.id);
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
  const pill: React.CSSProperties = { flex: 1, height: 52, padding: "0 18px", border: 0, borderRadius: "var(--radius-full)", cursor: "pointer", font: "700 var(--text-body-size) var(--font-family-body)", whiteSpace: "nowrap" };
  const group = (
    <div
      role="group"
      aria-label="Add a class"
      style={{
        display: "flex",
        gap: 8,
        padding: 6,
        borderRadius: "var(--radius-full)",
        background: "var(--color-bg-surface-primary-default)",
        border: "1px solid var(--color-border-primary-default)",
        boxShadow: floating ? "var(--shadow-lifted)" : "none",
        ...(floating ? { width: "min(100% - 32px, var(--size-column))", pointerEvents: "auto" as const } : { marginBottom: 14 }),
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
    <div className="bq-frontdesk-bookings-add-class-pills-row">
      {group}
    </div>,
    document.body,
  );
}

import { useMemo, useState } from "react";
import { api } from "../../lib/backend";
import { useAuth } from "../../lib/auth";
import { LocationSwitcher, useCurrentLocation } from "../../lib/locations";
import { isSoloOwner } from "../../lib/nav";
import { Button } from "../../components/Button";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { ClassSheet, emptyForm, formOf, type FormState } from "../ClassesManage";
import { useAsync } from "../../lib/useAsync";
import { useSetHeader } from "../../lib/header";
import { timeLabel, pad } from "../../lib/classTime";
import type { GymClass } from "../../lib/types";
import { Segmented } from "../../components/Segmented";
import { Spinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { ClassRosterSheet } from "../../components/ClassRosterSheet";
import { Card, SectionLink } from "./shared";
import { ClassCalendarScreen } from "./ClassCalendar";

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
  const { locations, current, ready: locsReady } = useCurrentLocation();
  // The selected location's sessions only (each location is run separately).
  const place = locations.length > 1 ? (current?.id ?? "all") : "all";
  const [cancelling, setCancelling] = useState<GymClass | null>(null);
  const [range, setRange] = useState<Range>("today");
  const [open, setOpen] = useState<GymClass | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [month, setMonth] = useState(false);
  const classes = useAsync(() => api.classes(startOfDay(new Date()).toISOString()), []);

  const { groups, earlier } = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(new Date());
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
    return { groups: [...map.values()], earlier: live.filter(isPast) };
  }, [classes.data, range, place]);

  if (month) return <ClassCalendarScreen onClose={() => setMonth(false)} />;
  if (!locsReady || !classes.data) return <Spinner />;

  const today = startOfDay(new Date());
  const nowMs = Date.now();
  const nextId = groups[0]?.items.find((c) => Date.parse(c.startsAt) + 60 * 60000 >= nowMs)?.id;

  const row = (c: GymClass, muted = false) => {
    const start = Date.parse(c.startsAt);
    const happening = start <= nowMs && nowMs < start + 60 * 60000;
    const booked = c.bookedCount ?? 0;
    return (
      <div key={c.id} style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--line)", opacity: muted ? 0.65 : 1 }}>
      <button
        onClick={() => (solo ? setForm(formOf(c)) : setOpen(c))}
        style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, padding: "14px 18px", border: 0, background: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ width: 84, flex: "none", whiteSpace: "nowrap", font: "700 14px var(--font-mono)", color: happening ? "var(--primary-pressed)" : "var(--ink)" }}>{clock(c.startsAt)}</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
          {solo ? (
            <span style={{ display: "block", font: "400 13px var(--font-mono)", color: booked > 0 ? "var(--primary-pressed)" : "var(--ink-faint)" }}>
              {booked === 0 ? "No one yet" : `${booked} coming`}
            </span>
          ) : (
            <span style={{ display: "block", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
              {booked === 0 ? "No one booked" : `${booked} booked`}
              {(c.dropInSeats ?? 0) > 0 ? ` · ${c.dropInSeats} pay per class` : ""}
            </span>
          )}
        </span>
        {happening && <span style={{ font: "700 11px var(--font-mono)", color: "var(--paid-fg)", background: "var(--paid-bg)", padding: "3px 8px", borderRadius: 999 }}>NOW</span>}
        {!happening && c.id === nextId && <span style={{ font: "700 11px var(--font-mono)", color: "var(--primary-pressed)", background: "var(--primary-tint)", padding: "3px 8px", borderRadius: 999 }}>NEXT</span>}
        <Icon name="chevron-right" size={16} />
      </button>
      {false && solo && !muted && (
        <button onClick={() => setForm(formOf(c))} aria-label={`Edit ${c.title}`} style={{ flex: "none", width: 36, height: 36, margin: "0 14px 0 0", borderRadius: 999, border: 0, background: "var(--primary-tint)", color: "var(--primary-pressed)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="pencil" size={15} />
        </button>
      )}
      </div>
    );
  };

  return (
    <div>
      <LocationSwitcher />
      {solo && (
        <Button fullWidth size="lg" style={{ marginBottom: 14 }} onClick={() => setForm({ ...emptyForm(), locationId: place !== "all" ? place : (current?.id ?? null) })}>
          <Icon name="plus" size={18} /> Add class
        </Button>
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

      {groups.length === 0 && earlier.length === 0 && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <EmptyState bare icon="calendar" title={range === "today" ? (solo ? "No more classes today" : "Nothing booked for the rest of today") : "No classes in this range"} body={solo ? "Add a class and your members are reminded before it starts." : "Classes appear here as soon as they're scheduled."} />
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

      {solo && (
        <>
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

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { useIsMobile } from "../../lib/useIsMobile";
import { pad, timeLabel, WEEKDAY_ORDER, WEEKDAY_SHORT } from "../../lib/classTime";
import type { GymClass } from "../../lib/types";
import { Segmented } from "../../components/Segmented";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { ClassRosterSheet } from "../../components/ClassRosterSheet";

type View = "day" | "week" | "month";

// Days are the device's local days (the desk's own clock); weeks run Saturday
// to Friday like the class editor.
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 1) % 7));
const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();
const clock = (d: Date) => timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
const hourLabel = (h: number) => (h === 0 ? "" : timeLabel(`${pad(h)}:00`).replace(":00", ""));

// Classes don't carry a length yet, so each one is drawn as an hour.
const CLASS_MINUTES = 60;

function title(view: View, cursor: Date): string {
  if (view === "day") return cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (view === "month") return cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const a = startOfWeek(cursor);
  const b = addDays(a, 6);
  const sameMonth = a.getMonth() === b.getMonth();
  return sameMonth
    ? `${a.toLocaleDateString(undefined, { month: "long" })} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
    : `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${b.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

interface Placed {
  c: GymClass;
  start: number;
  end: number;
  lane: number;
  lanes: number;
}

/** Side-by-side lanes for classes that overlap in time, like a calendar app. */
function layoutDay(items: GymClass[]): Placed[] {
  const evs: Placed[] = items
    .map((c) => {
      const start = minutesOf(new Date(c.startsAt));
      return { c, start, end: Math.min(start + CLASS_MINUTES, 24 * 60), lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.start - b.start);
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const laneEnds: number[] = [];
  const flush = () => {
    const n = laneEnds.length || 1;
    cluster.forEach((e) => (e.lanes = n));
    cluster = [];
    laneEnds.length = 0;
    clusterEnd = -1;
  };
  for (const e of evs) {
    if (cluster.length && e.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= e.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e.end);
    } else laneEnds[lane] = e.end;
    e.lane = lane;
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.end);
  }
  flush();
  return evs;
}

/** The desk's class calendar, full screen: a day or week on an hourly grid,
 * or the whole month. Opening a class shows its roster, where arrivals are
 * marked and payment is taken. */
export function ClassCalendarScreen({ onClose }: { onClose: () => void }) {
  const isMobile = useIsMobile();
  // A phone starts on the day; anything wider on the week.
  const [view, setView] = useState<View>(() => (window.innerWidth < 640 ? "day" : "week"));
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [roster, setRoster] = useState<GymClass | null>(null);
  // Classes load from two weeks back; going further back loads more.
  const [since, setSince] = useState(() => addDays(startOfDay(new Date()), -14));
  const classes = useAsync(() => api.classes(since.toISOString()), [since.getTime()]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    const first = view === "month" ? new Date(cursor.getFullYear(), cursor.getMonth(), 1) : view === "week" ? startOfWeek(cursor) : cursor;
    if (first < since) setSince(addDays(first, -7));
  }, [cursor, view, since]);
  // Escape closes the calendar (unless a roster is open on top of it).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !roster && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, roster]);

  const byDay = useMemo(() => {
    const m = new Map<string, GymClass[]>();
    for (const c of classes.data?.classes ?? []) {
      if (c.status !== "active") continue;
      const k = dayKey(new Date(c.startsAt));
      m.set(k, [...(m.get(k) ?? []), c].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)));
    }
    return m;
  }, [classes.data]);
  const on = (d: Date) => byDay.get(dayKey(d)) ?? [];

  const today = startOfDay(now);
  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "day" ? addDays(c, dir) : view === "week" ? addDays(c, 7 * dir) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));

  return createPortal(
    <div
      data-testid="class-calendar"
      style={{ position: "fixed", inset: 0, zIndex: 150, background: "var(--surface)", display: "flex", flexDirection: "column", paddingTop: "var(--safe-top)" }}
    >
      <div style={{ flex: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: isMobile ? "10px 12px" : "12px 20px", borderBottom: "1px solid var(--line)" }}>
        <Button variant="quiet" aria-label="Close calendar" style={{ width: 44, height: 44, padding: 0 }} onClick={onClose}>
          <Icon name="close" size={18} />
        </Button>
        {!isMobile && <span style={{ font: "800 20px var(--font-body)", letterSpacing: "-.01em", marginRight: 8 }}>Classes</span>}
        <Button variant="secondary" style={{ height: 44, padding: "0 14px", font: "700 12px var(--font-mono)", letterSpacing: ".06em" }} onClick={() => setCursor(today)}>
          TODAY
        </Button>
        <Button variant="quiet" aria-label="Previous" style={{ width: 44, height: 44, padding: 0 }} onClick={() => step(-1)}>
          <Icon name="chevron-left" size={18} />
        </Button>
        <Button variant="quiet" aria-label="Next" style={{ width: 44, height: 44, padding: 0 }} onClick={() => step(1)}>
          <Icon name="chevron-right" size={18} />
        </Button>
        <div data-testid="calendar-label" style={{ flex: 1, minWidth: 140, font: "800 18px var(--font-body)", letterSpacing: "-.01em" }}>
          {title(view, cursor)}
        </div>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "day", label: "DAY" },
            { value: "week", label: "WEEK" },
            { value: "month", label: "MONTH" },
          ]}
        />
      </div>

      {classes.error && (
        <div style={{ flex: "none", font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", padding: "10px 20px" }}>{classes.error}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {classes.loading && !classes.data ? (
          <Spinner />
        ) : view === "month" ? (
          <MonthGrid
            cursor={cursor}
            today={today}
            on={on}
            wide={!isMobile}
            onDay={(d) => {
              setCursor(d);
              setView("day");
            }}
            onOpen={setRoster}
          />
        ) : (
          <TimeGrid days={view === "day" ? [cursor] : Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i))} today={today} now={now} on={on} narrow={isMobile} onDay={(d) => { setCursor(d); setView("day"); }} onOpen={setRoster} />
        )}
      </div>

      <ClassRosterSheet open={roster !== null} onClose={() => setRoster(null)} classId={roster?.id ?? null} title={roster?.title ?? "Class"} />
    </div>,
    document.body,
  );
}

const HOUR_H = 60;
const GUTTER = 56;

function TimeGrid({ days, today, now, on, narrow, onDay, onOpen }: { days: Date[]; today: Date; now: Date; on: (d: Date) => GymClass[]; narrow: boolean; onDay: (d: Date) => void; onOpen: (c: GymClass) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const columns = days.length;
  const anyToday = days.some((d) => dayKey(d) === dayKey(today));
  const firstMinute = useMemo(() => {
    const all = days.flatMap((d) => on(d)).map((c) => minutesOf(new Date(c.startsAt)));
    return all.length ? Math.min(...all) : null;
  }, [days, on]);
  const rangeKey = dayKey(days[0]) + columns;

  // Open on the morning's first class, or the current time, or 7 AM.
  useEffect(() => {
    const target = firstMinute ?? (anyToday ? minutesOf(now) : 7 * 60);
    const el = scroller.current;
    if (el) {
      el.scrollTop = Math.max(0, (target / 60 - 1) * HOUR_H);
      // On a phone the week is wider than the screen: bring today into view.
      const i = days.findIndex((d) => dayKey(d) === dayKey(today));
      if (colMin && i > 0) el.scrollLeft = Math.max(0, (i - 1) * colMin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const colMin = narrow && columns > 1 ? 84 : 0;
  const template = `${GUTTER}px repeat(${columns}, minmax(${colMin}px, 1fr))`;
  const empty = columns === 1 && on(days[0]).length === 0;

  return (
    <div ref={scroller} data-testid="time-grid" style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}>
      <div style={{ minWidth: GUTTER + columns * colMin }}>
        {/* Day headers stay in view while the hours scroll. */}
        <div style={{ position: "sticky", top: 0, zIndex: 3, display: "grid", gridTemplateColumns: template, background: "var(--surface)", borderBottom: "1px solid var(--line)" }}>
          <div />
          {days.map((d) => {
            const isToday = dayKey(d) === dayKey(today);
            return (
              <button
                key={dayKey(d)}
                type="button"
                data-testid="week-day"
                onClick={() => onDay(d)}
                style={{ border: 0, background: "none", cursor: columns > 1 ? "pointer" : "default", padding: "8px 4px", textAlign: "center", borderLeft: "1px solid var(--line)" }}
              >
                <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: isToday ? "var(--primary-pressed)" : "var(--ink-muted)" }}>{WEEKDAY_SHORT[d.getDay()].toUpperCase()}</div>
                <div
                  style={{
                    margin: "2px auto 0",
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    font: "800 18px var(--font-body)",
                    background: isToday ? "var(--primary)" : "transparent",
                    color: isToday ? "var(--surface)" : "var(--ink)",
                  }}
                >
                  {d.getDate()}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: template, position: "relative" }}>
          <div style={{ position: "relative", height: 24 * HOUR_H }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ position: "absolute", top: h * HOUR_H - 7, right: 8, font: "500 11px var(--font-mono)", color: "var(--ink-faint)" }}>
                {hourLabel(h)}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const isToday = dayKey(d) === dayKey(today);
            return (
              <div
                key={dayKey(d)}
                style={{
                  position: "relative",
                  height: 24 * HOUR_H,
                  borderLeft: "1px solid var(--line)",
                  backgroundImage: "linear-gradient(var(--line) 1px, transparent 1px)",
                  backgroundSize: `100% ${HOUR_H}px`,
                }}
              >
                {layoutDay(on(d)).map((e) => {
                  const height = Math.max(((e.end - e.start) / 60) * HOUR_H - 2, 30);
                  return (
                    <button
                      key={e.c.id}
                      type="button"
                      data-sq
                      data-testid="calendar-class"
                      onClick={() => onOpen(e.c)}
                      style={{
                        position: "absolute",
                        top: (e.start / 60) * HOUR_H + 1,
                        height,
                        left: `calc(${(e.lane / e.lanes) * 100}% + 2px)`,
                        width: `calc(${100 / e.lanes}% - 4px)`,
                        textAlign: "left",
                        border: 0,
                        borderLeft: "3px solid var(--primary)",
                        borderRadius: 8,
                        background: "var(--primary-tint)",
                        color: "var(--primary-pressed)",
                        padding: "4px 6px",
                        cursor: "pointer",
                        overflow: "hidden",
                        minWidth: 0,
                      }}
                    >
                      <div style={{ font: "700 13px/1.2 var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.c.title}</div>
                      <div style={{ font: "500 11px var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {clock(new Date(e.c.startsAt))} · {e.c.bookedCount ?? 0} booked
                      </div>
                    </button>
                  );
                })}
                {isToday && (
                  <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: (minutesOf(now) / 60) * HOUR_H, height: 0, borderTop: "2px solid var(--danger-fg)", zIndex: 2, pointerEvents: "none" }}>
                    <span style={{ position: "absolute", left: -5, top: -6, width: 10, height: 10, borderRadius: 999, background: "var(--danger-fg)" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {empty && (
        <div style={{ position: "sticky", bottom: 16, textAlign: "center", pointerEvents: "none", font: "600 14px var(--font-body)", color: "var(--ink-muted)" }}>
          <span style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999, padding: "8px 16px" }}>No classes this day</span>
        </div>
      )}
    </div>
  );
}

function MonthGrid({ cursor, today, on, wide, onDay, onOpen }: { cursor: Date; today: Date; on: (d: Date) => GymClass[]; wide: boolean; onDay: (d: Date) => void; onOpen: (c: GymClass) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 1) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i - lead));
  const shownChips = wide ? 3 : 2;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
      <div style={{ flex: "none", display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderBottom: "1px solid var(--line)" }}>
        {WEEKDAY_ORDER.map((w) => (
          <div key={w} style={{ textAlign: "center", font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-muted)", padding: "8px 0" }}>
            {WEEKDAY_SHORT[w].toUpperCase()}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gridTemplateRows: `repeat(${weeks}, minmax(${wide ? 104 : 84}px, 1fr))` }}>
        {cells.map((d) => {
          const items = on(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = dayKey(d) === dayKey(today);
          return (
            <div
              key={dayKey(d)}
              data-testid="month-day"
              role="button"
              tabIndex={0}
              aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${items.length} ${items.length === 1 ? "class" : "classes"}`}
              onClick={() => onDay(d)}
              onKeyDown={(e) => e.key === "Enter" && onDay(d)}
              style={{ minWidth: 0, padding: 4, cursor: "pointer", borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", opacity: inMonth ? 1 : 0.45, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}
            >
              <span
                style={{
                  alignSelf: "center",
                  minWidth: 26,
                  height: 26,
                  padding: "0 4px",
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: "700 13px var(--font-body)",
                  background: isToday ? "var(--primary)" : "transparent",
                  color: isToday ? "var(--surface)" : "var(--ink)",
                }}
              >
                {d.getDate()}
              </span>
              {items.slice(0, shownChips).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-testid="calendar-class"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(c);
                  }}
                  style={{ border: 0, textAlign: "left", cursor: "pointer", borderRadius: 6, background: "var(--primary-tint)", color: "var(--primary-pressed)", padding: "2px 5px", font: "700 11px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                >
                  {wide ? `${clock(new Date(c.startsAt)).replace(" ", "").toLowerCase()} ${c.title}` : c.title}
                </button>
              ))}
              {items.length > shownChips && <span style={{ font: "700 11px var(--font-mono)", color: "var(--ink-muted)", paddingLeft: 4 }}>+{items.length - shownChips} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

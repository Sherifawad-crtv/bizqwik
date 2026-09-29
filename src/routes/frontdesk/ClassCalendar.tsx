import { useMemo, useState } from "react";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { useIsMobile } from "../../lib/useIsMobile";
import { egp } from "../../lib/format";
import { pad, timeLabel, WEEKDAY_ORDER, WEEKDAY_SHORT } from "../../lib/classTime";
import type { GymClass } from "../../lib/types";
import { Segmented } from "../../components/Segmented";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { ClassRosterSheet } from "../../components/ClassRosterSheet";

type View = "day" | "week" | "month";

// Days are the device's local days (the desk's own clock), weeks run
// Saturday to Friday like the class editor.
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 1) % 7));
const clock = (iso: string) => {
  const d = new Date(iso);
  return timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
};

function label(view: View, cursor: Date): string {
  if (view === "day") return cursor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  if (view === "month") return cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const a = startOfWeek(cursor);
  const b = addDays(a, 6);
  return `${a.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${b.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

/** The desk's class calendar: a day, a week or a month at a time. Opening a
 * class shows its roster, where arrivals are marked and payment is taken. */
export function ClassCalendar() {
  const classes = useAsync(() => api.classes(), []);
  const isMobile = useIsMobile();
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [roster, setRoster] = useState<GymClass | null>(null);

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

  const today = startOfDay(new Date());
  const step = (dir: 1 | -1) =>
    setCursor((c) => (view === "day" ? addDays(c, dir) : view === "week" ? addDays(c, 7 * dir) : new Date(c.getFullYear(), c.getMonth() + dir, 1)));
  const goToday = () => setCursor(today);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
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

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Button variant="quiet" aria-label="Previous" style={{ width: 44, height: 44, padding: 0 }} onClick={() => step(-1)}>
          <Icon name="chevron-left" size={18} />
        </Button>
        <div data-testid="calendar-label" style={{ flex: 1, minWidth: 0, textAlign: "center", font: "800 18px var(--font-body)", letterSpacing: "-.01em" }}>
          {label(view, cursor)}
        </div>
        <Button variant="quiet" aria-label="Next" style={{ width: 44, height: 44, padding: 0 }} onClick={() => step(1)}>
          <Icon name="chevron-right" size={18} />
        </Button>
        <Button variant="secondary" style={{ height: 44, padding: "0 14px", font: "700 12px var(--font-mono)", letterSpacing: ".06em" }} onClick={goToday}>
          TODAY
        </Button>
      </div>

      {classes.loading && <Spinner />}
      {classes.error && (
        <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{classes.error}</div>
      )}

      {!classes.loading && view === "day" && <DayList date={cursor} items={on(cursor)} onOpen={setRoster} />}

      {!classes.loading && view === "week" && (
        <WeekView start={startOfWeek(cursor)} today={today} on={on} grid={!isMobile} onOpen={setRoster} />
      )}

      {!classes.loading && view === "month" && (
        <MonthView cursor={cursor} today={today} on={on} wide={!isMobile} onSelect={setCursor} onOpen={setRoster} />
      )}

      <ClassRosterSheet open={roster !== null} onClose={() => setRoster(null)} classId={roster?.id ?? null} title={roster?.title ?? "Class"} />
    </div>
  );
}

function ClassRow({ c, onOpen }: { c: GymClass; onOpen: (c: GymClass) => void }) {
  return (
    <button
      type="button"
      data-sq
      data-testid="calendar-class"
      onClick={() => onOpen(c)}
      style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, width: "100%" }}
    >
      <span style={{ flex: "none", width: 74, font: "700 13px var(--font-mono)", color: "var(--primary-pressed)" }}>{clock(c.startsAt)}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
        <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>{c.bookedCount ?? 0} booked</div>
      </div>
      <span className="tabular" style={{ flex: "none", font: "800 14px var(--font-body)" }}>{c.price > 0 ? egp(c.price) : "Free"}</span>
      <span style={{ flex: "none", color: "var(--ink-faint)", display: "flex" }}>
        <Icon name="chevron-right" size={18} />
      </span>
    </button>
  );
}

function DayList({ date, items, onOpen }: { date: Date; items: GymClass[]; onOpen: (c: GymClass) => void }) {
  if (items.length === 0) {
    return <EmptyState icon="calendar" title="No classes this day" body={`Nothing is scheduled for ${date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}. The department head schedules classes in Catalog → Classes.`} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((c) => (
        <ClassRow key={c.id} c={c} onOpen={onOpen} />
      ))}
    </div>
  );
}

function WeekView({ start, today, on, grid, onOpen }: { start: Date; today: Date; on: (d: Date) => GymClass[]; grid: boolean; onOpen: (c: GymClass) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  if (grid) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
        {days.map((d) => {
          const isToday = dayKey(d) === dayKey(today);
          return (
            <div key={dayKey(d)} data-testid="week-day" style={{ minWidth: 0 }}>
              <div style={{ textAlign: "center", padding: "8px 0", borderRadius: 12, background: isToday ? "var(--primary-tint)" : "var(--sunken)", color: isToday ? "var(--primary-pressed)" : "var(--ink-muted)", marginBottom: 6 }}>
                <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".06em" }}>{WEEKDAY_SHORT[d.getDay()].toUpperCase()}</div>
                <div style={{ font: "800 18px var(--font-body)" }}>{d.getDate()}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {on(d).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-sq
                    data-testid="calendar-class"
                    onClick={() => onOpen(c)}
                    style={{ textAlign: "left", border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 12, padding: "7px 8px", cursor: "pointer", minWidth: 0 }}
                  >
                    <div style={{ font: "700 11px var(--font-mono)", color: "var(--primary-pressed)" }}>{clock(c.startsAt)}</div>
                    <div style={{ font: "700 13px/1.2 var(--font-body)", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflowWrap: "anywhere" }}>{c.title}</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {days.map((d) => {
        const isToday = dayKey(d) === dayKey(today);
        const items = on(d);
        return (
          <section key={dayKey(d)} data-testid="week-day">
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ font: "800 15px var(--font-body)", color: isToday ? "var(--primary-pressed)" : "var(--ink)" }}>{d.toLocaleDateString(undefined, { weekday: "long" })}</span>
              <span style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>{d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
              {isToday && <span style={{ font: "700 10px var(--font-mono)", letterSpacing: ".08em", color: "var(--primary-pressed)", background: "var(--primary-tint)", borderRadius: 999, padding: "2px 8px" }}>TODAY</span>}
            </div>
            {items.length === 0 ? (
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", padding: "2px 2px 0" }}>No classes</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((c) => (
                  <ClassRow key={c.id} c={c} onOpen={onOpen} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MonthView({ cursor, today, on, wide, onSelect, onOpen }: { cursor: Date; today: Date; on: (d: Date) => GymClass[]; wide: boolean; onSelect: (d: Date) => void; onOpen: (c: GymClass) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 1) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i - lead));
  const selected = dayKey(cursor);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 4 }}>
        {WEEKDAY_ORDER.map((w) => (
          <div key={w} style={{ textAlign: "center", font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-faint)", padding: "4px 0" }}>
            {WEEKDAY_SHORT[w].toUpperCase()}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 4 }}>
        {cells.map((d) => {
          const items = on(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = dayKey(d) === dayKey(today);
          const isSel = dayKey(d) === selected;
          return (
            <button
              key={dayKey(d)}
              type="button"
              data-sq
              data-testid="month-day"
              aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${items.length} ${items.length === 1 ? "class" : "classes"}`}
              aria-pressed={isSel}
              onClick={() => onSelect(d)}
              style={{
                minHeight: wide ? 84 : 52,
                minWidth: 0,
                padding: 6,
                textAlign: "left",
                cursor: "pointer",
                borderRadius: 12,
                border: isSel ? "2px solid var(--primary)" : "1px solid var(--line)",
                background: isToday ? "var(--primary-tint)" : "var(--surface)",
                opacity: inMonth ? 1 : 0.4,
                display: "flex",
                flexDirection: "column",
                gap: 3,
                overflow: "hidden",
              }}
            >
              <span style={{ font: "800 14px var(--font-body)", color: isToday ? "var(--primary-pressed)" : "var(--ink)" }}>{d.getDate()}</span>
              {wide ? (
                <>
                  {items.slice(0, 2).map((c) => (
                    <span key={c.id} style={{ font: "600 11px var(--font-body)", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {clock(c.startsAt).replace(" ", "").toLowerCase()} {c.title}
                    </span>
                  ))}
                  {items.length > 2 && <span style={{ font: "700 11px var(--font-mono)", color: "var(--primary-pressed)" }}>+{items.length - 2} more</span>}
                </>
              ) : (
                items.length > 0 && <span style={{ alignSelf: "flex-start", font: "700 11px var(--font-mono)", color: "var(--primary-pressed)", background: "var(--primary-tint)", borderRadius: 999, padding: "1px 7px" }}>{items.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ font: "800 16px var(--font-body)", margin: "18px 2px 10px" }}>{cursor.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</div>
      <DayList date={cursor} items={on(cursor)} onOpen={onOpen} />
    </div>
  );
}


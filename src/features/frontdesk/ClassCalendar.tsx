import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../shared/api/backend";
import { useAsync } from "../../shared/api/useAsync";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import type { GymClass } from "../../shared/types";
import { Segmented } from "../../design-system/components/Segmented";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { InlineSpinner } from "../../design-system/components/Spinner";
import { ClassRosterSheet } from "../../shared/components/ClassRosterSheet";
import { type View, addDays, dayKey, startOfDay, startOfWeek, title } from "./calendar/dates";
import { TimeGrid } from "./calendar/TimeGrid";
import { MonthGrid } from "./calendar/MonthGrid";

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
      style={{ position: "fixed", inset: 0, zIndex: 150, background: "var(--color-bg-surface-primary-default)", display: "flex", flexDirection: "column", paddingTop: "var(--safe-top)" }}
    >
      <div style={{ flex: "none", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: isMobile ? "10px 12px" : "12px 20px", borderBottom: "1px solid var(--color-border-primary-default)" }}>
        <Button variant="quiet" aria-label="Close calendar" style={{ width: 44, height: 44, padding: 0 }} onClick={onClose}>
          <Icon name="close" size={18} />
        </Button>
        {!isMobile && <span className="bq-stat-sm" style={{ marginRight: 8 }}>Classes</span>}
        <Button variant="secondary" style={{ height: 44, padding: "0 14px", font: "700 var(--text-caption-1-size) var(--font-family-mono)", letterSpacing: ".06em" }} onClick={() => setCursor(today)}>
          TODAY
        </Button>
        <Button variant="quiet" aria-label="Previous" style={{ width: 44, height: 44, padding: 0 }} onClick={() => step(-1)}>
          <Icon name="chevron-left" size={18} />
        </Button>
        <Button variant="quiet" aria-label="Next" style={{ width: 44, height: 44, padding: 0 }} onClick={() => step(1)}>
          <Icon name="chevron-right" size={18} />
        </Button>
        <div data-testid="calendar-label" style={{ flex: 1, minWidth: 140, font: "800 18px var(--font-family-body)", letterSpacing: "-.01em" }}>
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
        <div style={{ flex: "none", font: "600 var(--text-footnote-size)/1.5 var(--font-family-body)", color: "var(--color-text-status-danger-default)", background: "var(--color-bg-fill-status-danger-default)", padding: "10px 20px" }}>{classes.error}</div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {classes.loading && !classes.data ? (
          <InlineSpinner />
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

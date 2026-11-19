import { useEffect, useMemo, useRef } from "react";
import { WEEKDAY_SHORT } from "../../../shared/classTime";
import type { GymClass } from "../../../shared/types";
import { GUTTER, clock, dayKey, hourLabel, layoutDay, minutesOf } from "./dates";
import "./TimeGrid.css";

const HOUR_H = 60;

export function TimeGrid({ days, today, now, on, narrow, onDay, onOpen }: { days: Date[]; today: Date; now: Date; on: (d: Date) => GymClass[]; narrow: boolean; onDay: (d: Date) => void; onOpen: (c: GymClass) => void }) {
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
    // Deliberate: Scroll once when the calendar opens, not on every data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  const colMin = narrow && columns > 1 ? 84 : 0;
  const template = `${GUTTER}px repeat(${columns}, minmax(${colMin}px, 1fr))`;
  const empty = columns === 1 && on(days[0]).length === 0;

  return (
    <div className="bq-frontdesk-time-grid-size" ref={scroller} data-testid="time-grid">
      <div style={{ minWidth: GUTTER + columns * colMin }}>
        {/* Day headers stay in view while the hours scroll. */}
        <div className="bq-frontdesk-time-grid" style={{ gridTemplateColumns: template }}>
          <div />
          {days.map((d) => {
            const isToday = dayKey(d) === dayKey(today);
            return (
              <button className="bq-frontdesk-time-grid-btn"
                key={dayKey(d)}
                type="button"
                data-testid="week-day"
                onClick={() => onDay(d)}
                style={{ cursor: columns > 1 ? "pointer" : "default" }}
              >
                <div className="bq-frontdesk-time-grid-label" style={{ color: isToday ? "var(--color-bg-fill-primary-active)" : "var(--color-text-secondary-default)" }}>{WEEKDAY_SHORT[d.getDay()].toUpperCase()}</div>
                <div className="bq-frontdesk-time-grid-title"
                  style={{ background: isToday ? "var(--color-bg-fill-primary-default)" : "transparent", color: isToday ? "var(--color-bg-surface-primary-default)" : "var(--color-text-primary-default)" }}
                >
                  {d.getDate()}
                </div>
              </button>
            );
          })}
        </div>

        <div className="bq-grid bq-relative" style={{ gridTemplateColumns: template }}>
          <div className="bq-relative" style={{ height: 24 * HOUR_H }}>
            {Array.from({ length: 24 }, (_, h) => (
              <div className="bq-frontdesk-time-grid-meta" key={h} style={{ top: h * HOUR_H - 7 }}>
                {hourLabel(h)}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const isToday = dayKey(d) === dayKey(today);
            return (
              <div className="bq-frontdesk-time-grid-part"
                key={dayKey(d)}
                style={{ height: 24 * HOUR_H, backgroundSize: `100% ${HOUR_H}px` }}
              >
                {layoutDay(on(d)).map((e) => {
                  const height = Math.max(((e.end - e.start) / 60) * HOUR_H - 2, 30);
                  return (
                    <button className="bq-frontdesk-time-grid-btn-2"
                      key={e.c.id}
                      type="button"
                      data-testid="calendar-class"
                      onClick={() => onOpen(e.c)}
                      style={{ top: (e.start / 60) * HOUR_H + 1, height, left: `calc(${(e.lane / e.lanes) * 100}% + 2px)`, width: `calc(${100 / e.lanes}% - 4px)` }}
                    >
                      <div className="bq-frontdesk-time-grid-title-2">{e.c.title}</div>
                      <div className="bq-frontdesk-time-grid-meta-2">
                        {clock(new Date(e.c.startsAt))} · {e.c.bookedCount ?? 0} booked
                      </div>
                    </button>
                  );
                })}
                {isToday && (
                  <div className="bq-frontdesk-time-grid-layer" aria-hidden style={{ top: (minutesOf(now) / 60) * HOUR_H }}>
                    <span className="bq-frontdesk-time-grid-layer-2" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {empty && (
        <div className="bq-frontdesk-time-grid-text">
          <span className="bq-frontdesk-time-grid-box">No classes this day</span>
        </div>
      )}
    </div>
  );
}

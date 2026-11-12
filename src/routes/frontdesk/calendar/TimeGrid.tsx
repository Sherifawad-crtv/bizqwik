import { useEffect, useMemo, useRef } from "react";
import { WEEKDAY_SHORT } from "../../../lib/classTime";
import type { GymClass } from "../../../lib/types";
import { GUTTER, clock, dayKey, hourLabel, layoutDay, minutesOf } from "./dates";

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

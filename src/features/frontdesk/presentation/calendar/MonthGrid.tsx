import { WEEKDAY_ORDER, WEEKDAY_SHORT } from "../../../../shared/domain/classTime";
import type { GymClass } from "../../../../shared/types";
import { addDays, clock, dayKey } from "../../domain/calendar";
import "./MonthGrid.css";

export function MonthGrid({ cursor, today, on, wide, onDay, onOpen }: { cursor: Date; today: Date; on: (d: Date) => GymClass[]; wide: boolean; onDay: (d: Date) => void; onOpen: (c: GymClass) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 1) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i - lead));
  const shownChips = wide ? 3 : 2;
  return (
    <div className="bq-frontdesk-month-grid-stack">
      <div className="bq-frontdesk-month-grid">
        {WEEKDAY_ORDER.map((w) => (
          <div className="bq-frontdesk-month-grid-label" key={w}>
            {WEEKDAY_SHORT[w].toUpperCase()}
          </div>
        ))}
      </div>
      <div className="bq-frontdesk-month-grid-2" style={{ gridTemplateRows: `repeat(${weeks}, minmax(${wide ? 104 : 84}px, 1fr))` }}>
        {cells.map((d) => {
          const items = on(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = dayKey(d) === dayKey(today);
          return (
            <div className="bq-frontdesk-month-grid-stack-2"
              key={dayKey(d)}
              data-testid="month-day"
              role="button"
              tabIndex={0}
              aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${items.length} ${items.length === 1 ? "class" : "classes"}`}
              onClick={() => onDay(d)}
              onKeyDown={(e) => e.key === "Enter" && onDay(d)}
              style={{ opacity: inMonth ? 1 : 0.45 }}
            >
              <span className="bq-frontdesk-month-grid-title"
                style={{ background: isToday ? "var(--color-bg-fill-primary-default)" : "transparent", color: isToday ? "var(--color-bg-surface-primary-default)" : "var(--color-text-primary-default)" }}
              >
                {d.getDate()}
              </span>
              {items.slice(0, shownChips).map((c) => (
                <button className="bq-frontdesk-month-grid-btn"
                  key={c.id}
                  type="button"
                  data-testid="calendar-class"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(c);
                  }}
                >
                  {wide ? `${clock(new Date(c.startsAt)).replace(" ", "").toLowerCase()} ${c.title}` : c.title}
                </button>
              ))}
              {items.length > shownChips && <span className="bq-frontdesk-month-grid-meta">+{items.length - shownChips} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

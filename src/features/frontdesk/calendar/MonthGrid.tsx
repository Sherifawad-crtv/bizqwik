import { WEEKDAY_ORDER, WEEKDAY_SHORT } from "../../../shared/classTime";
import type { GymClass } from "../../../shared/types";
import { addDays, clock, dayKey } from "./dates";

export function MonthGrid({ cursor, today, on, wide, onDay, onOpen }: { cursor: Date; today: Date; on: (d: Date) => GymClass[]; wide: boolean; onDay: (d: Date) => void; onOpen: (c: GymClass) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lead = (first.getDay() + 1) % 7;
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i - lead));
  const shownChips = wide ? 3 : 2;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "auto" }}>
      <div style={{ flex: "none", display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", borderBottom: "1px solid var(--color-border-primary-default)" }}>
        {WEEKDAY_ORDER.map((w) => (
          <div key={w} style={{ textAlign: "center", font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".06em", color: "var(--color-text-secondary-default)", padding: "8px 0" }}>
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
              style={{ minWidth: 0, padding: 4, cursor: "pointer", borderRight: "1px solid var(--color-border-primary-default)", borderBottom: "1px solid var(--color-border-primary-default)", opacity: inMonth ? 1 : 0.45, display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}
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
                  font: "700 var(--text-footnote-size) var(--font-family-body)",
                  background: isToday ? "var(--color-bg-fill-primary-default)" : "transparent",
                  color: isToday ? "var(--color-bg-surface-primary-default)" : "var(--color-text-primary-default)",
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
                  style={{ border: 0, textAlign: "left", cursor: "pointer", borderRadius: "var(--radius-chip)", background: "var(--color-bg-fill-accent-default)", color: "var(--color-bg-fill-primary-active)", padding: "2px 5px", font: "700 var(--text-caption-2-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                >
                  {wide ? `${clock(new Date(c.startsAt)).replace(" ", "").toLowerCase()} ${c.title}` : c.title}
                </button>
              ))}
              {items.length > shownChips && <span style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", paddingLeft: 4 }}>+{items.length - shownChips} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

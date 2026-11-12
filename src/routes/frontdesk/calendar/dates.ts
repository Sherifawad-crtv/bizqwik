import { pad, timeLabel } from "../../../lib/classTime";
import type { GymClass } from "../../../lib/types";

export type View = "day" | "week" | "month";

// Days are the device's local days (the desk's own clock); weeks run Saturday
// to Friday like the class editor.
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 1) % 7));

export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

export const clock = (d: Date) => timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`);

export const hourLabel = (h: number) => (h === 0 ? "" : timeLabel(`${pad(h)}:00`).replace(":00", ""));

// Classes don't carry a length yet, so each one is drawn as an hour.
const CLASS_MINUTES = 60;

export function title(view: View, cursor: Date): string {
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
export function layoutDay(items: GymClass[]): Placed[] {
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

export const GUTTER = 56;

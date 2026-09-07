import type { Session } from "../lib/types";
import { StatePill } from "./StatePill";
import { dateLabel, egp } from "../lib/format";
import type { State } from "../lib/types";

interface DayGroup {
  date: string;
  sessions: Session[];
}

function groupByDate(sessions: Session[]): DayGroup[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const list = map.get(s.date) ?? [];
    list.push(s);
    map.set(s.date, list);
  }
  return Array.from(map.entries())
    .map(([date, list]) => ({ date, sessions: list }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function DayList({
  sessions,
  rate,
  state,
  onOpenDay,
}: {
  sessions: Session[];
  rate: number;
  state: State;
  onOpenDay: (group: DayGroup) => void;
}) {
  const groups = groupByDate(sessions);

  if (groups.length === 0) {
    return (
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "22px 16px", textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
        No sessions logged yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {groups.map((g) => (
        <div
          key={g.date}
          data-sq
          onClick={() => onOpenDay(g)}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-tile)",
            padding: "14px 16px",
            display: "flex",
            gap: 14,
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: "700 16px var(--font-body)", letterSpacing: "-.01em" }}>{dateLabel(g.date)}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>
              {g.sessions.length} {g.sessions.length === 1 ? "session" : "sessions"}
            </div>
            <div style={{ marginTop: 8 }}>
              <StatePill state={state} />
            </div>
          </div>
          <div style={{ textAlign: "right", flex: "none" }}>
            <div className="tabular" style={{ font: "800 20px var(--font-body)", letterSpacing: "-.01em" }}>{egp(g.sessions.length * rate).split(" ")[0]}</div>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>EGP</div>
          </div>
        </div>
      ))}
    </div>
  );
}

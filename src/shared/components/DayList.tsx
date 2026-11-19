import type { Session } from "../types";
import { StatePill } from "./StatePill";
import { EmptyState } from "../../design-system/components/EmptyState";
import { dateLabel, egp, sessionStamp } from "../format";
import type { State } from "../types";
import { MotionList } from "../../design-system/components/MotionList";
import "./DayList.css";

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
  emptyHint,
}: {
  sessions: Session[];
  rate: number;
  state: State;
  onOpenDay: (group: DayGroup) => void;
  /** One line on how sessions get logged, for the empty state. */
  emptyHint?: string;
}) {
  const groups = groupByDate(sessions);

  if (groups.length === 0) {
    return <EmptyState icon="calendar" title="No sessions logged this month" body={emptyHint ?? "Logged sessions show up here, grouped by day."} />;
  }

  return (
    <div className="bq-stack">
      <MotionList gap={10}>
{groups.map((g) => (
        <div
          key={g.date}
          onClick={() => onOpenDay(g)}
          className="bq-card bq-card--sm bq-flex bq-gap-14px bq-items-center bq-pointer"
        >
          <div className="bq-grow">
            <div className="bq-day-list-title">{dateLabel(g.date)}</div>
            <div className="bq-day-list-meta">
              {g.sessions.length} {g.sessions.length === 1 ? "session" : "sessions"}
            </div>
            {/* When each session was scanned in, so a late scan is easy to spot. */}
            <div className="bq-mt-1 bq-flex bq-col bq-gap-1px" data-testid="session-times">
              {[...g.sessions]
                .sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")))
                .map((s) => {
                  const st = sessionStamp(s);
                  return st ? (
                    <div className="bq-day-list-meta-2" key={s.id}>
                      <span className="bq-day-list-label">{s.source === "qr" ? "QR" : "MANUAL"}</span>
                      {st.text}
                    </div>
                  ) : null;
                })}
            </div>
            <div className="bq-mt-2">
              {/* A day that's on the books is "Logged"; the coach's month status (Logging / Settled / Paid) lives on their header. */}
              {state === "logging" ? <StatePill state="paid" label="Logged" /> : <StatePill state={state} />}
            </div>
          </div>
          <div className="bq-text-right bq-flex-none">
            <div className="tabular bq-stat-sm" >{egp(g.sessions.length * rate).split(" ")[0]}</div>
            <div className="bq-label">EGP</div>
          </div>
        </div>
      ))}
</MotionList>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../../shared/api/useAsync";
import { api } from "../../shared/api/backend";
import { egp } from "../../shared/format";
import { timeLabel, weekdaysLabel } from "../../shared/classTime";
import type { ClassSeries, Location } from "../../shared/types";
import { LocationPill, atLocation, useLocations } from "../../shared/locations";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Spinner } from "../../design-system/components/Spinner";
import { EmptyRow } from "./shared";
import { SectionHeader } from "../../design-system/components/SectionHeader";
import { useCatalogHere } from "./helpers";
import { MotionList } from "../../design-system/components/MotionList";
import { IconButton } from "../../design-system/components/IconButton";
import { SeriesSheet } from "../../shared/components/SeriesSheet";

export function ClassesPanel({ solo }: { solo?: boolean }) {
  const navigate = useNavigate();
  const { data } = useAsync(() => api.classSeries(), []);
  const locations = useLocations();
  const catalogHere = useCatalogHere();
  const [editing, setEditing] = useState<ClassSeries | "new" | null>(null);

  if (!data) return <Spinner />;
  const active = data.series.filter((s) => s.status === "active" && atLocation(s.locationId, catalogHere));
  const ended = data.series.filter((s) => s.status === "ended");

  return (
    <div>
      <SectionHeader
        count={active.length}
        right={
          <Button size="md" style={{ height: 40, padding: "0 16px" }} onClick={() => setEditing("new")}>
            + New class
          </Button>
        }
      >
        Group classes
      </SectionHeader>
      <div className="bq-panel">
        <MotionList>
{active.map((s, i) => (
          <SeriesRow key={s.id} s={s} last={i === active.length - 1} onEdit={() => setEditing(s)} locations={locations} />
        ))}
</MotionList>
        {active.length === 0 && <EmptyRow text="No classes yet. Create one and it repeats every week until you change it. Members can then drop in or buy a monthly." action={{ label: "+ New class", onClick: () => setEditing("new") }} />}
      </div>

      <button
        onClick={() => navigate(solo ? "/bookings" : "/classes")}
        className="bq-card" style={{ width: "100%", marginTop: 12, textAlign: "left", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
      >
        <span style={{ color: "var(--color-bg-fill-primary-active)", display: "flex" }}>
          <Icon name="calendar" size={20} />
        </span>
        <span className="bq-grow">
          <span style={{ display: "block", font: "700 var(--text-body-size) var(--font-family-body)" }}>Upcoming sessions & rosters</span>
          <span style={{ display: "block", font: "400 var(--text-caption-1-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", marginTop: 2 }}>Who's booked, attendance, one-off changes</span>
        </span>
        <Icon name="chevron-right" size={18} />
      </button>

      {ended.length > 0 && (
        <>
          <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", margin: "24px 2px 10px" }}>ENDED · {ended.length}</div>
          <div className="bq-card bq-card--clip" style={{ opacity: 0.6 }}>
            {ended.map((s, i) => (
              <SeriesRow key={s.id} s={s} last={i === ended.length - 1} />
            ))}
          </div>
        </>
      )}

      <SeriesSheet open={editing !== null} series={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function SeriesRow({ s, last, onEdit, locations = [] }: { s: ClassSeries; last: boolean; onEdit?: () => void; locations?: Location[] }) {
  return (
    <div className={`bq-listrow ${!(last) ? "bq-listrow--divider" : ""}`}>
      {s.imageUrl && <img src={s.imageUrl} alt="" style={{ width: 40, height: 50, flex: "none", borderRadius: "var(--radius-chip)", objectFit: "cover" }} />}
      <div className="bq-grow">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "700 var(--text-callout-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
          <LocationPill locations={locations} id={s.locationId} />
        </div>
        <div className="bq-meta">
          {weekdaysLabel(s.weekdays)} · {timeLabel(s.startTime)} · {s.durationMin} min
        </div>
        <div style={{ font: "500 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", marginTop: 2 }}>
          {s.dropInPrice === 0 && s.monthlyPrice === 0 ? "" : <>Drop-in {egp(s.dropInPrice)} · Monthly {egp(s.monthlyPrice)}</>}
          {s.activeMonthlySubscribers ? ` · ${s.activeMonthlySubscribers} monthly` : ""}
        </div>
      </div>
      {onEdit && (
        <IconButton icon="pencil" label={`Edit ${s.title}`} onClick={onEdit} />
      )}
    </div>
  );
}

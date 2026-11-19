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
import "./Classes.css";

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
          <Button className="bq-catalog-classes-classes-panel-btn" size="md" onClick={() => setEditing("new")}>
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
        className="bq-card bq-catalog-classes-classes-panel-btn-2"
      >
        <span className="bq-catalog-classes-classes-panel-row">
          <Icon name="calendar" size={20} />
        </span>
        <span className="bq-grow">
          <span className="bq-catalog-classes-classes-panel-title">Upcoming sessions & rosters</span>
          <span className="bq-catalog-classes-classes-panel-meta">Who's booked, attendance, one-off changes</span>
        </span>
        <Icon name="chevron-right" size={18} />
      </button>

      {ended.length > 0 && (
        <>
          <div className="bq-catalog-classes-classes-panel-label">ENDED · {ended.length}</div>
          <div className="bq-card bq-card--clip bq-catalog-classes-classes-panel-part">
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
      {s.imageUrl && <img className="bq-catalog-classes-series-row-img" src={s.imageUrl} alt="" />}
      <div className="bq-grow">
        <div className="bq-flex bq-items-center bq-gap-2">
          <span className="bq-catalog-classes-series-row-title">{s.title}</span>
          <LocationPill locations={locations} id={s.locationId} />
        </div>
        <div className="bq-meta">
          {weekdaysLabel(s.weekdays)} · {timeLabel(s.startTime)} · {s.durationMin} min
        </div>
        <div className="bq-catalog-classes-series-row-meta">
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

import { useFrozen, useMountedThroughExit } from "../../lib/useLatch";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../../lib/useAsync";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { api } from "../../lib/backend";
import { egp } from "../../lib/format";
import { WEEKDAY_ORDER, WEEKDAY_SHORT, timeLabel, weekdaysLabel } from "../../lib/classTime";
import { TimeWheelField } from "../../components/TimeWheelField";
import { ClassPhotoField } from "../../components/ClassPhotoField";
import type { ClassSeries, Location } from "../../lib/types";
import { LocationField, LocationPill, atLocation, useCurrentLocation, useLocations } from "../../lib/locations";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { TextField, SelectField } from "../../components/FormField";
import { Spinner } from "../../components/Spinner";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { useAuth } from "../../lib/auth";
import { EmptyRow, PanelHeader, iconBtn, useCatalogHere } from "./shared";

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
      <PanelHeader
        title="Group classes"
        count={active.length}
        action={
          <Button size="md" style={{ height: 40, padding: "0 16px" }} onClick={() => setEditing("new")}>
            + New class
          </Button>
        }
      />
      <div className="bq-panel">
        {active.map((s, i) => (
          <SeriesRow key={s.id} s={s} last={i === active.length - 1} onEdit={() => setEditing(s)} locations={locations} />
        ))}
        {active.length === 0 && <EmptyRow text="No classes yet. Create one and it repeats every week until you change it. Members can then drop in or buy a monthly." action={{ label: "+ New class", onClick: () => setEditing("new") }} />}
      </div>

      <button
        onClick={() => navigate(solo ? "/bookings" : "/classes")}
        style={{ width: "100%", marginTop: 12, textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
      >
        <span style={{ color: "var(--primary-pressed)", display: "flex" }}>
          <Icon name="calendar" size={20} />
        </span>
        <span className="bq-grow">
          <span style={{ display: "block", font: "700 15px var(--font-body)" }}>Upcoming sessions & rosters</span>
          <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>Who's booked, attendance, one-off changes</span>
        </span>
        <Icon name="chevron-right" size={18} />
      </button>

      {ended.length > 0 && (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "24px 2px 10px" }}>ENDED · {ended.length}</div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden", opacity: 0.6 }}>
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
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      {s.imageUrl && <img src={s.imageUrl} alt="" style={{ width: 40, height: 50, flex: "none", borderRadius: 10, objectFit: "cover" }} />}
      <div className="bq-grow">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
          <LocationPill locations={locations} id={s.locationId} />
        </div>
        <div className="bq-meta">
          {weekdaysLabel(s.weekdays)} · {timeLabel(s.startTime)} · {s.durationMin} min
        </div>
        <div style={{ font: "500 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>
          {s.dropInPrice === 0 && s.monthlyPrice === 0 ? "" : <>Drop-in {egp(s.dropInPrice)} · Monthly {egp(s.monthlyPrice)}</>}
          {s.activeMonthlySubscribers ? ` · ${s.activeMonthlySubscribers} monthly` : ""}
        </div>
      </div>
      {onEdit && (
        <button className="bq-hit" onClick={onEdit} aria-label={`Edit ${s.title}`} style={iconBtn()}>
          <Icon name="pencil" size={15} />
        </button>
      )}
    </div>
  );
}

function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  return (
    <div>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", marginBottom: 8 }}>DAYS</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {WEEKDAY_ORDER.map((d) => {
          const on = value.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
              style={{
                height: 44,
                borderRadius: 12,
                border: on ? "0" : "1px solid var(--line)",
                background: on ? "var(--accent)" : "var(--sunken)",
                color: on ? "var(--accent-ink)" : "var(--ink-muted)",
                font: "700 12px var(--font-mono)",
                cursor: "pointer",
              }}
            >
              {WEEKDAY_SHORT[d]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DURATION_OPTIONS = [30, 45, 60, 75, 90, 120].map((m) => ({ value: String(m), label: `${m} min` }));

export function SeriesSheet({ open, series: seriesProp, onClose }: { open: boolean; series: ClassSeries | null; onClose: () => void }) {
  const mounted = useMountedThroughExit(open);
  const series = useFrozen(open, seriesProp);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("18:00");
  const [duration, setDuration] = useState("60");
  const [dropIn, setDropIn] = useState("");
  const [monthly, setMonthly] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const { orgMode: seriesMode } = useAuth();
  const seriesSolo = seriesMode === "solo";
  const locations = useLocations();
  const { current } = useCurrentLocation();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successLabel, setSuccessLabel] = useState("");
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose, { quiet: true });

  useEffect(() => {
    if (open) {
      setTitle(series?.title ?? "");
      setDescription(series?.description ?? "");
      setWeekdays(series?.weekdays ?? []);
      setStartTime(series?.startTime ?? "18:00");
      setDuration(String(series?.durationMin ?? 60));
      setDropIn(series ? String(series.dropInPrice) : "");
      setMonthly(series ? String(series.monthlyPrice) : "");
      setImageUrl(series?.imageUrl ?? null);
      setLocationId(series ? (series.locationId ?? null) : (current?.id ?? null));
      setConfirmEnd(false);
      setError(null);
    }
    // Deliberate: Reset the form when the sheet opens or its subject changes; the default location is read at that moment (a late-arriving location must not wipe the form).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, series]);

  if (!mounted) return null;

  const save = async () => {
    const dropInNum = Number(dropIn);
    const monthlyNum = Number(monthly);
    if (!title.trim()) return setError("Give the class a name.");
    if (weekdays.length === 0) return setError("Pick at least one day.");
    // Her prices live in her packages and drop-ins, not on the class itself.
    if (!seriesSolo && (dropIn === "" || !Number.isFinite(dropInNum) || dropInNum < 0)) return setError("Enter the drop-in price (0 for free).");
    if (!seriesSolo && (monthly === "" || !Number.isFinite(monthlyNum) || monthlyNum < 0)) return setError("Enter the monthly price.");
    if (locations.length > 0 && !locationId) return setError("Choose the location.");
    const input = { title: title.trim(), description: description.trim() || null, weekdays, startTime, durationMin: Number(duration), dropInPrice: seriesSolo ? 0 : dropInNum, monthlyPrice: seriesSolo ? 0 : monthlyNum, imageUrl, ...(locations.length > 0 ? { locationId } : {}) };
    setBusy(true);
    setError(null);
    try {
      if (series) {
        const r = await api.updateClassSeries(series.id, input);
        setSuccessLabel(r.keptBookedSessions > 0 ? `Saved · ${r.keptBookedSessions} booked session${r.keptBookedSessions === 1 ? "" : "s"} kept as-is` : "Class updated");
      } else {
        await api.createClassSeries(input);
        setSuccessLabel("Class created");
      }
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open && !confirmEnd} onClose={busy ? () => {} : onClose}>
        {confirmed ? (
          <SheetSuccessIcon label={successLabel} iconIn={iconIn} />
        ) : (
          <>
            <div className="bq-label">{series ? "EDIT CLASS" : "NEW GROUP CLASS"}</div>
            <div className="bq-title">{series ? series.title : "New class"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <TextField label="NAME" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sunrise HIIT" />
              <TextField label="DESCRIPTION" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional — shown to members" />
              <ClassPhotoField value={imageUrl} onChange={setImageUrl} title={title} />
              <LocationField locations={locations} value={locationId} onChange={setLocationId} />
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <TimeWheelField label="STARTS AT" value={startTime} onChange={setStartTime} />
                <SelectField label="LENGTH" value={duration} options={DURATION_OPTIONS} onChange={setDuration} />
              </div>
              {!seriesSolo && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <TextField label="DROP-IN · EGP" type="number" min={0} inputMode="decimal" value={dropIn} onChange={(e) => setDropIn(e.target.value)} placeholder="Per class" />
                  <TextField label="MONTHLY · EGP" type="number" min={0} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="1 month" />
                </div>
              )}
            </div>
            <div style={{ marginTop: 10, font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
              {series
                ? (seriesSolo ? "Changes apply to all upcoming sessions of this class." : "Changes apply to upcoming sessions nobody has booked yet. Booked sessions keep their time and price.")
                : seriesSolo
                  ? "Repeats every week on these days until you change or end it. Your members see it in their schedule and can say they're coming."
                  : "Repeats every week on these days until you change or end it. Members can drop in per class or buy the monthly."}
            </div>
            {error && (
              <div  className="bq-error bq-error--spaced bq-rise">{error}</div>
            )}
            <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
              {busy ? "Saving…" : series ? "Save changes" : "Create class"}
            </Button>
            {series && (
              <Button variant="danger" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={() => setConfirmEnd(true)}>
                End this class
              </Button>
            )}
            <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          </>
        )}
      </Sheet>
      {series && (
        <ConfirmSheet
          open={confirmEnd}
          onClose={() => setConfirmEnd(false)}
          kicker="END CLASS"
          title={`End ${series.title}?`}
          sub="It stops repeating. Upcoming sessions nobody booked are removed; booked ones stay on the schedule. Current monthly subscribers keep their month."
          confirmLabel="End class"
          danger
          onConfirm={async () => {
            await api.endClassSeries(series.id);
            onClose();
          }}
        />
      )}
    </>
  );
}

// ---------- Group plans (memberships + class bundles) ----------

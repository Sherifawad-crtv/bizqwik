import { EmptyState } from "../components/EmptyState";
import { useSticky } from "../lib/useSticky";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { useLatch } from "../lib/useLatch";
import { useSheetSuccess } from "../lib/useSheetSuccess";
import { api } from "../lib/backend";
import { egp, fmt } from "../lib/format";
import { WEEKDAY_ORDER, WEEKDAY_SHORT, timeLabel, weekdaysLabel } from "../lib/classTime";
import { TimeWheelField } from "../components/TimeWheelField";
import { ClassPhotoField } from "../components/ClassPhotoField";
import type { ClassSeries, GroupPlanType, GroupPlanTypeKind, Location } from "../lib/types";
import { CategoryPill } from "../lib/category";
import { LocationField, LocationPill, LocationSwitcher, atLocation, useCurrentLocation, useLocations } from "../lib/locations";
import { Segmented } from "../components/Segmented";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { TextField, SelectField } from "../components/FormField";
import { canvasToDataUrl } from "../lib/image";
import { Spinner } from "../components/Spinner";
import { SheetSuccessIcon } from "../components/SheetSuccessIcon";
import { BundlesPanel } from "./Manage";
import { useAuth } from "../lib/auth";

type Tab = "classes" | "plans" | "pt";

/** The founder's catalog: everything the gym sells. Group classes (recurring,
 * each with a drop-in and a monthly price), group plans (all-access
 * memberships and class bundles), and private-training bundles. */
export function Catalog() {
  const { orgMode } = useAuth();
  const solo = orgMode === "solo";
  // A solo owner opens on her plans; a team catalog on its classes.
  const [tab, setTab] = useSticky<Tab>("catalogTab", solo ? "plans" : "classes", { valid: (v) => ["classes","plans","pt"].includes(v) });
  useSetHeader(solo ? { kicker: "WHAT YOU SELL", title: "Plans" } : { kicker: "WHAT YOU SELL", title: "Catalog" }, [solo]);
  const { ready: locsReady } = useCurrentLocation();

  return (
    <div>
      {solo && <LocationSwitcher />}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "classes", label: "CLASSES" },
            { value: "plans", label: "PLANS" },
            { value: "pt", label: "PT BUNDLES" },
          ]}
        />
      </div>
      {!locsReady ? (
        <Spinner />
      ) : (
        <>
          {tab === "classes" && <ClassesPanel solo={solo} />}
          {tab === "plans" && (solo ? (<div><LocationsCard /><SoloOffer /><PlansPanel solo /></div>) : <PlansPanel />)}
          {tab === "pt" && <BundlesPanel />}
        </>
      )}
    </div>
  );
}

const iconBtn = (danger?: boolean): React.CSSProperties => ({
  width: 36,
  height: 36,
  flex: "none",
  borderRadius: 999,
  border: 0,
  background: danger ? "var(--danger-bg)" : "var(--primary-tint)",
  color: danger ? "var(--danger-fg)" : "var(--primary-pressed)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

function PanelHeader({ title, count, action }: { title: string; count: number; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>{title}</span>
      <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{count}</span>
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
}

function EmptyRow({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  const [title, ...rest] = text.split(". ");
  return <EmptyState bare icon="tag" title={title.replace(/\.$/, "")} body={rest.join(". ") || undefined} action={action} />;
}

// ---------- Classes (recurring series) ----------

function ClassesPanel({ solo }: { solo?: boolean }) {
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
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        {active.map((s, i) => (
          <SeriesRow key={s.id} s={s} last={i === active.length - 1} onEdit={() => setEditing(s)} locations={locations} />
        ))}
        {active.length === 0 && <EmptyRow text="No classes yet. Create one and it repeats every week until you change it. Members can then drop in or buy a monthly." action={{ label: "+ New class", onClick: () => setEditing("new") }} />}
      </div>

      <button
        onClick={() => navigate(solo ? "/bookings" : "/classes")}
        data-sq
        style={{ width: "100%", marginTop: 12, textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
      >
        <span style={{ color: "var(--primary-pressed)", display: "flex" }}>
          <Icon name="calendar" size={20} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", font: "700 15px var(--font-body)" }}>Upcoming sessions & rosters</span>
          <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>Who's booked, attendance, one-off changes</span>
        </span>
        <Icon name="chevron-right" size={18} />
      </button>

      {ended.length > 0 && (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "24px 2px 10px" }}>ENDED · {ended.length}</div>
          <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden", opacity: 0.6 }}>
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
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</span>
          <LocationPill locations={locations} id={s.locationId} />
        </div>
        <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
          {weekdaysLabel(s.weekdays)} · {timeLabel(s.startTime)} · {s.durationMin} min
        </div>
        <div style={{ font: "500 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>
          {s.dropInPrice === 0 && s.monthlyPrice === 0 ? "" : <>Drop-in {egp(s.dropInPrice)} · Monthly {egp(s.monthlyPrice)}</>}
          {s.activeMonthlySubscribers ? ` · ${s.activeMonthlySubscribers} monthly` : ""}
        </div>
      </div>
      {onEdit && (
        <button onClick={onEdit} aria-label={`Edit ${s.title}`} style={iconBtn()}>
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

export function SeriesSheet({ open, series, onClose }: { open: boolean; series: ClassSeries | null; onClose: () => void }) {
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
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

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
  }, [open, series]);

  if (!open) return null;

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
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{series ? "EDIT CLASS" : "NEW GROUP CLASS"}</div>
            <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{series ? series.title : "New class"}</div>
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
              <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>
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

function PlansPanel({ solo }: { solo?: boolean }) {
  const { data } = useAsync(() => api.planTypes(), []);
  const locations = useLocations();
  const catalogHere = useCatalogHere();
  const [editing, setEditing] = useState<{ kind: GroupPlanTypeKind; planType: GroupPlanType | null } | null>(null);
  const [deleting, setDeleting] = useState<GroupPlanType | null>(null);
  const shownDeleting = useLatch(deleting);

  if (!data) return <Spinner />;

  const section = (kind: GroupPlanTypeKind, title: string, empty: string) => {
    const rows = data.planTypes.filter((p) => p.kind === kind && atLocation(p.locationId, catalogHere));
    return (
      <div style={{ marginBottom: 28 }}>
        <PanelHeader
          title={title}
          count={rows.length}
          action={
            <Button size="md" style={{ height: 40, padding: "0 16px" }} onClick={() => setEditing({ kind, planType: null })}>
              + {kind === "membership" ? "Membership" : "Bundle"}
            </Button>
          }
        />
        <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
          {rows.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)", opacity: p.active ? 1 : 0.6 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <CategoryPill name={p.name} />
                  <LocationPill locations={locations} id={p.locationId} />
                  {!p.active && <span style={{ flex: "none", font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-muted)", background: "var(--sunken)", borderRadius: 8, padding: "3px 7px" }}>OFF SALE</span>}
                </div>
                <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
                  {fmt(p.price)} EGP · {p.kind === "bundle" ? `${p.credits} classes · ` : "all classes · "}
                  {p.durationMonths} month{p.durationMonths === 1 ? "" : "s"}
                  {p.invitationsAllowance > 0 ? ` · ${p.invitationsAllowance} guest pass${p.invitationsAllowance === 1 ? "" : "es"}` : ""}
                </div>
              </div>
              <button onClick={() => setEditing({ kind, planType: p })} aria-label={`Edit ${p.name}`} style={iconBtn()}>
                <Icon name="pencil" size={15} />
              </button>
              <button onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`} style={iconBtn(true)}>
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
          {rows.length === 0 && <EmptyRow text={empty} action={{ label: kind === "bundle" ? "+ New class bundle" : "+ New membership", onClick: () => setEditing({ kind, planType: null }) }} />}
        </div>
      </div>
    );
  };

  return (
    <div>
      {!solo && section("membership", "Memberships", solo ? "No memberships yet. A membership covers every class at its location for the months you choose." : "No memberships yet. A membership covers every class for the months you choose.")}
      {section("bundle", solo ? "Packages" : "Class bundles", solo ? "No packages yet. A package is a number of classes valid for 1 or 3 months; one class is used each day the member checks in." : "No bundles yet. A bundle is a pack of sessions: one is used each day the member checks in.")}
      {!solo && <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "-12px 2px 0" }}>
        Each class's monthly is set on the class itself. A member holds one group plan at a time, and a new one can only be bought once the current one is finished.
      </div>}

      <PlanTypeSheet open={editing !== null} kind={editing?.kind ?? "membership"} planType={editing?.planType ?? null} onClose={() => setEditing(null)} />
      {shownDeleting && (
        <ConfirmSheet
          open={!!deleting}
          onClose={() => setDeleting(null)}
          kicker="DELETE PLAN"
          title={`Delete ${shownDeleting.name}?`}
          sub="Only possible if it has never been sold — otherwise take it off sale instead."
          confirmLabel="Delete plan"
          danger
          onConfirm={async () => {
            await api.deletePlanType(shownDeleting.id);
          }}
        />
      )}
    </div>
  );
}

// Her packages are valid for 1 month or 3 months.
const SOLO_MONTH_OPTIONS = [
  { value: "1", label: "1 month" },
  { value: "3", label: "3 months" },
];
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} month${i === 0 ? "" : "s"}` }));

export function PlanTypeSheet({ open, kind, planType, onClose }: { open: boolean; kind: GroupPlanTypeKind; planType: GroupPlanType | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [months, setMonths] = useState("1");
  const [credits, setCredits] = useState("");
  const [invitations, setInvitations] = useState("");
  const [onSale, setOnSale] = useState<"on" | "off">("on");
  const { orgMode: sheetMode } = useAuth();
  const sheetSolo = sheetMode === "solo";
  const [locationId, setLocationId] = useState<string | null>(null);
  const locations = useLocations();
  const { current } = useCurrentLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);
  const isBundle = kind === "bundle";

  useEffect(() => {
    if (open) {
      setName(planType?.name ?? "");
      setPrice(planType ? String(planType.price) : "");
      setMonths(String(planType?.durationMonths ?? 1));
      setCredits(planType?.credits != null ? String(planType.credits) : "");
      setInvitations(planType ? String(planType.invitationsAllowance) : "");
      setOnSale(planType && !planType.active ? "off" : "on");
      setLocationId(planType ? (planType.locationId ?? null) : (current?.id ?? null));
      setError(null);
    }
  }, [open, planType]);

  if (!open) return null;

  const save = async () => {
    const priceNum = Number(price);
    const creditsNum = Number(credits);
    const invitesNum = invitations === "" ? 0 : Number(invitations);
    if (!name.trim()) return setError("Give it a name.");
    if (price === "" || !Number.isFinite(priceNum) || priceNum < 0) return setError("Enter a price.");
    if (isBundle && (!Number.isInteger(creditsNum) || creditsNum < 1)) return setError("Enter how many classes the bundle includes.");
    if (!Number.isInteger(invitesNum) || invitesNum < 0) return setError("Guest passes must be a whole number, 0 or more.");
    if (locations.length > 0 && !locationId) return setError("Choose the location it's for.");
    const input = { kind, name: name.trim(), price: priceNum, durationMonths: Number(months), credits: isBundle ? creditsNum : null, invitationsAllowance: invitesNum, ...(locations.length > 0 ? { locationId } : {}) };
    setBusy(true);
    setError(null);
    try {
      if (planType) await api.updatePlanType(planType.id, { ...input, active: onSale === "on" });
      else await api.createPlanType(input);
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const noun = isBundle ? "bundle" : "membership";
  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={planType ? "Plan updated" : `${isBundle ? "Bundle" : "Membership"} created`} iconIn={iconIn} />
      ) : (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{planType ? `EDIT ${noun.toUpperCase()}` : isBundle ? "NEW CLASS BUNDLE" : "NEW MEMBERSHIP"}</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{planType ? planType.name : isBundle ? "New bundle" : "New membership"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder={isBundle ? "10-Class Pack" : "All-Access · 3 Months"} />
            <TextField label="PRICE · EGP" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <LocationField locations={locations} value={locationId} onChange={setLocationId} />
            {isBundle && <TextField label="CLASSES INCLUDED" type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="10" />}
            <SelectField label={isBundle ? "VALID FOR" : "LENGTH"} value={months} options={sheetSolo ? SOLO_MONTH_OPTIONS : MONTH_OPTIONS} onChange={setMonths} />
            <TextField label="GUEST PASSES INCLUDED" type="number" min={0} value={invitations} onChange={(e) => setInvitations(e.target.value)} placeholder="0" />
            {planType && (
              <Segmented
                value={onSale}
                onChange={setOnSale}
                options={[
                  { value: "on", label: "ON SALE" },
                  { value: "off", label: "OFF SALE" },
                ]}
              />
            )}
          </div>
          <div style={{ marginTop: 10, font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
            {isBundle ? "One session is used each day the member checks in (booking a class only reserves the spot). " : "Covers every class. "}
            Runs from the day it's bought. Changes apply to future sales only.
          </div>
          {error && (
            <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>
          )}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
            {busy ? "Saving…" : planType ? "Save changes" : `Create ${noun}`}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}


/** Resize a picked image to at most 700px and return it as a WebP data URL. */
function readQr(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 700 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(canvasToDataUrl(c, 0.92));
    };
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = url;
  });
}

/** The solo owner's one-off drop-in price and her InstaPay QR. */
function SoloOffer() {
  const settings = useAsync(() => api.orgSettings(), []);
  const catalogHere = useCatalogHere();
  const { current: catalogCurrent } = useCurrentLocation();
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState("");
  // With locations: the list of drop-ins (e.g. Kids / Adults) being edited.
  const [rows, setRows] = useState<{ label: string; price: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  if (!settings.data) return null;
  const { instapayQr, instapayAddress } = settings.data;
  const saveAddress = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.saveOrgSettings({ instapayAddress: (address ?? "").trim() || null });
      setAddress(null);
      settings.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  // With locations, each has its own drop-in price.
  const dropInPrice = catalogHere ? (settings.data.dropInPrices[catalogHere] ?? null) : settings.data.dropInPrice;
  const dropInList = catalogHere ? (settings.data.dropInOptions[catalogHere] ?? []) : [];

  const saveList = async () => {
    const clean = rows.map((r) => ({ label: r.label.trim(), price: Number(r.price) }));
    if (clean.some((r) => !r.label || r.price < 0 || !Number.isFinite(r.price))) return setError("Each drop-in needs a name and a price.");
    setBusy(true);
    setError(null);
    try {
      await api.saveOrgSettings({ locationId: catalogHere!, dropInOptions: clean });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  const savePrice = async () => {
    const n = Number(price);
    if (price.trim() === "" || !Number.isFinite(n) || n < 0) return setError("Enter the drop-in price.");
    setBusy(true);
    setError(null);
    try {
      await api.saveOrgSettings(catalogHere ? { dropInPrice: n, locationId: catalogHere } : { dropInPrice: n });
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  const pickQr = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await api.saveOrgSettings({ instapayQr: await readQr(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the QR.");
    }
  };

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 20px", marginBottom: 12 };
  return (
    <div style={{ marginBottom: 12 }}>
      <div data-sq style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 16px var(--font-body)" }}>Drop-in{catalogCurrent && catalogHere ? ` · ${catalogCurrent.name}` : ""}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
              {catalogHere ? (dropInList.length === 0 ? "Not set" : dropInList.map((o) => `${o.label} ${fmt(o.price)}`).join(" · ") + " EGP") : dropInPrice === null ? "Not set" : `${fmt(dropInPrice)} EGP · one visit`}
            </div>
          </div>
          <Button size="md" variant="secondary" style={{ height: 40, padding: "0 16px" }} onClick={() => {
            if (catalogHere) setRows(dropInList.length ? dropInList.map((o) => ({ label: o.label, price: String(o.price) })) : [{ label: "Kids", price: "" }, { label: "Adults", price: "" }]);
            else setPrice(dropInPrice === null ? "" : String(dropInPrice));
            setError(null);
            setEditing(true);
          }}>
            {(catalogHere ? dropInList.length === 0 : dropInPrice === null) ? "Set price" : "Edit"}
          </Button>
        </div>
        {editing && catalogHere && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
                <TextField label="NAME" value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Kids" />
                <TextField label="PRICE · EGP" type="number" min={0} inputMode="decimal" value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <button aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))} style={{ ...iconBtn(true), marginBottom: 6 }}><Icon name="trash" size={15} /></button>
              </div>
            ))}
            {rows.length < 6 && <Button variant="quiet" onClick={() => setRows([...rows, { label: "", price: "" }])}>+ Another drop-in</Button>}
            <div style={{ display: "flex", gap: 8 }}>
              <Button style={{ flex: 1 }} disabled={busy} onClick={saveList}>{busy ? "Saving…" : "Save"}</Button>
              <Button variant="quiet" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {editing && !catalogHere && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField label="DROP-IN PRICE · EGP" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <Button style={{ flex: 1 }} disabled={busy} onClick={savePrice}>{busy ? "Saving…" : "Save"}</Button>
              <Button variant="quiet" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div data-sq style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {instapayQr && <img src={instapayQr} alt="Your InstaPay QR" style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8, background: "#fff", border: "1px solid var(--line)" }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 16px var(--font-body)" }}>InstaPay QR</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{instapayQr ? "Shown when someone pays by InstaPay" : "Add it to show on drop-ins"}</div>
          </div>
          <label style={{ flex: "none", display: "inline-flex", alignItems: "center", height: 40, padding: "0 16px", borderRadius: 999, background: "var(--primary-tint)", color: "var(--primary-pressed)", font: "700 14px var(--font-body)", cursor: "pointer" }}>
            {instapayQr ? "Replace" : "Add QR"}
            <input type="file" accept="image/*" hidden onChange={(e) => { void pickQr(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      <div data-sq style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 16px var(--font-body)" }}>InstaPay address</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{instapayAddress ?? "Members copy this to pay you"}</div>
          </div>
          {address === null && (
            <Button size="md" variant="secondary" style={{ height: 40, padding: "0 16px" }} onClick={() => { setAddress(instapayAddress ?? ""); setError(null); }}>
              {instapayAddress ? "Edit" : "Add"}
            </Button>
          )}
        </div>
        {address !== null && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField label="INSTAPAY ADDRESS" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="name@instapay" autoCapitalize="none" autoCorrect="off" />
            <div style={{ display: "flex", gap: 8 }}>
              <Button style={{ flex: 1 }} disabled={busy} onClick={saveAddress}>{busy ? "Saving…" : "Save"}</Button>
              <Button variant="quiet" disabled={busy} onClick={() => setAddress(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
      {error && <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px", marginBottom: 12 }}>{error}</div>}
    </div>
  );
}


/** The places she works. Every session, plan and PT bundle belongs to one. */
function LocationsCard() {
  const { data } = useAsync(() => api.locations(), []);
  const [editing, setEditing] = useState<{ id: string | null; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;
  const list = data.locations ?? [];

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return setError("Give the location a name.");
    setBusy(true);
    setError(null);
    try {
      if (editing.id) await api.renameLocation(editing.id, name);
      else await api.createLocation(name);
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: list.length ? 8 : 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 16px var(--font-body)" }}>Locations</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{list.length === 0 ? "Working in more than one place? Add them." : "Each plan, PT bundle and session belongs to one."}</div>
          </div>
          {list.length < 10 && (
            <Button size="md" variant="secondary" style={{ height: 40, padding: "0 16px" }} onClick={() => { setError(null); setEditing({ id: null, name: "" }); }}>
              + Location
            </Button>
          )}
        </div>
        {list.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <Icon name="map-pin" size={16} />
            <span style={{ flex: 1, minWidth: 0, font: "600 15px var(--font-body)" }}>{l.name}</span>
            <button onClick={() => { setError(null); setEditing({ id: l.id, name: l.name }); }} aria-label={`Rename ${l.name}`} style={iconBtn()}>
              <Icon name="pencil" size={15} />
            </button>
          </div>
        ))}
      </div>
      <Sheet open={editing !== null} onClose={busy ? () => {} : () => setEditing(null)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{editing?.id ? "RENAME LOCATION" : "NEW LOCATION"}</div>
        <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{editing?.id ? "Rename" : "Add a location"}</div>
        <TextField label="NAME" value={editing?.name ?? ""} onChange={(e) => setEditing((x) => (x ? { ...x, name: e.target.value } : x))} placeholder="e.g. Zamalek studio" />
        {error && <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>}
        <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
        <Button variant="secondary" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
      </Sheet>
    </div>
  );
}

/** With 2+ locations, the location the Plans tab is showing; else null (all). */
function useCatalogHere(): string | null {
  const { locations, current } = useCurrentLocation();
  return locations.length > 1 ? (current?.id ?? null) : null;
}

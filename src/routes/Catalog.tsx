import { EmptyState } from "../components/EmptyState";
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
import type { ClassSeries, GroupPlanType, GroupPlanTypeKind } from "../lib/types";
import { Segmented } from "../components/Segmented";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { TextField, SelectField } from "../components/FormField";
import { Spinner } from "../components/Spinner";
import { SheetSuccessIcon } from "../components/SheetSuccessIcon";
import { BundlesPanel } from "./Manage";

type Tab = "classes" | "plans" | "pt";

/** The founder's catalog: everything the gym sells. Group classes (recurring,
 * each with a drop-in and a monthly price), group plans (all-access
 * memberships and class bundles), and private-training bundles. */
export function Catalog() {
  const [tab, setTab] = useState<Tab>("classes");
  useSetHeader({ kicker: "WHAT YOU SELL", title: "Catalog" }, []);

  return (
    <div>
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
      {tab === "classes" && <ClassesPanel />}
      {tab === "plans" && <PlansPanel />}
      {tab === "pt" && <BundlesPanel />}
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

function ClassesPanel() {
  const navigate = useNavigate();
  const { data } = useAsync(() => api.classSeries(), []);
  const [editing, setEditing] = useState<ClassSeries | "new" | null>(null);

  if (!data) return <Spinner />;
  const active = data.series.filter((s) => s.status === "active");
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
          <SeriesRow key={s.id} s={s} last={i === active.length - 1} onEdit={() => setEditing(s)} />
        ))}
        {active.length === 0 && <EmptyRow text="No classes yet. Create one and it repeats every week until you change it. Members can then drop in or buy a monthly." action={{ label: "+ New class", onClick: () => setEditing("new") }} />}
      </div>

      <button
        onClick={() => navigate("/classes")}
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

function SeriesRow({ s, last, onEdit }: { s: ClassSeries; last: boolean; onEdit?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
        <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
          {weekdaysLabel(s.weekdays)} · {timeLabel(s.startTime)} · {s.durationMin} min
        </div>
        <div style={{ font: "500 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>
          Drop-in {egp(s.dropInPrice)} · Monthly {egp(s.monthlyPrice)}
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
    if (dropIn === "" || !Number.isFinite(dropInNum) || dropInNum < 0) return setError("Enter the drop-in price (0 for free).");
    if (monthly === "" || !Number.isFinite(monthlyNum) || monthlyNum < 0) return setError("Enter the monthly price.");
    const input = { title: title.trim(), description: description.trim() || null, weekdays, startTime, durationMin: Number(duration), dropInPrice: dropInNum, monthlyPrice: monthlyNum };
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
              <WeekdayPicker value={weekdays} onChange={setWeekdays} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <TimeWheelField label="STARTS AT" value={startTime} onChange={setStartTime} />
                <SelectField label="LENGTH" value={duration} options={DURATION_OPTIONS} onChange={setDuration} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <TextField label="DROP-IN · EGP" type="number" min={0} inputMode="decimal" value={dropIn} onChange={(e) => setDropIn(e.target.value)} placeholder="Per class" />
                <TextField label="MONTHLY · EGP" type="number" min={0} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="1 month" />
              </div>
            </div>
            <div style={{ marginTop: 10, font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
              {series
                ? "Changes apply to upcoming sessions nobody has booked yet. Booked sessions keep their time and price."
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

function PlansPanel() {
  const { data } = useAsync(() => api.planTypes(), []);
  const [editing, setEditing] = useState<{ kind: GroupPlanTypeKind; planType: GroupPlanType | null } | null>(null);
  const [deleting, setDeleting] = useState<GroupPlanType | null>(null);
  const shownDeleting = useLatch(deleting);

  if (!data) return <Spinner />;

  const section = (kind: GroupPlanTypeKind, title: string, empty: string) => {
    const rows = data.planTypes.filter((p) => p.kind === kind);
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
      {section("membership", "Memberships", "No memberships yet. A membership covers every class for the months you choose.")}
      {section("bundle", "Class bundles", "No bundles yet. A bundle is a pack of class credits usable on any class.")}
      <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "-12px 2px 0" }}>
        Each class's monthly is set on the class itself. A member holds one group plan at a time, and a new one can only be bought once the current one is finished.
      </div>

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

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} month${i === 0 ? "" : "s"}` }));

export function PlanTypeSheet({ open, kind, planType, onClose }: { open: boolean; kind: GroupPlanTypeKind; planType: GroupPlanType | null; onClose: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [months, setMonths] = useState("1");
  const [credits, setCredits] = useState("");
  const [invitations, setInvitations] = useState("");
  const [onSale, setOnSale] = useState<"on" | "off">("on");
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
    const input = { kind, name: name.trim(), price: priceNum, durationMonths: Number(months), credits: isBundle ? creditsNum : null, invitationsAllowance: invitesNum };
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
            {isBundle && <TextField label="CLASSES INCLUDED" type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="10" />}
            <SelectField label={isBundle ? "VALID FOR" : "LENGTH"} value={months} options={MONTH_OPTIONS} onChange={setMonths} />
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
            {isBundle ? "Credits work on any class. " : "Covers every class. "}
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

import { useFrozen, useMountedThroughExit } from "../../lib/useLatch";
import { useEffect, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useLatch } from "../../lib/useLatch";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { api } from "../../lib/backend";
import { fmt } from "../../lib/format";
import type { GroupPlanType, GroupPlanTypeKind } from "../../lib/types";
import { CategoryPill } from "../../lib/category";
import { LocationField, LocationPill, atLocation, useCurrentLocation, useLocations } from "../../lib/locations";
import { Segmented } from "../../components/Segmented";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { TextField, SelectField } from "../../components/FormField";
import { Spinner } from "../../components/Spinner";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { useAuth } from "../../lib/auth";
import { EmptyRow, PanelHeader, iconBtn, useCatalogHere } from "./shared";

export function PlansPanel({ solo }: { solo?: boolean }) {
  const { data } = useAsync(() => api.planTypes(), []);
  const locations = useLocations();
  const catalogHere = useCatalogHere();
  const [editing, setEditing] = useState<{ kind: GroupPlanTypeKind; planType: GroupPlanType | null } | null>(null);
  const [deleting, setDeleting] = useState<GroupPlanType | null>(null);
  const shownDeleting = useLatch(deleting);

  if (!data) return <Spinner />;

  const section = (kind: GroupPlanTypeKind, title: string, empty: string) => {
    // Plans taken off sale are gone from the list; people who hold one keep it.
    const rows = data.planTypes.filter((p) => p.kind === kind && p.active && atLocation(p.locationId, catalogHere));
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
        <div className="bq-panel">
          {rows.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: i === rows.length - 1 ? "none" : "1px solid var(--line)", opacity: p.active ? 1 : 0.6 }}>
              <div className="bq-grow">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <CategoryPill name={p.name} />
                  <LocationPill locations={locations} id={p.locationId} />
                  {!p.active && <span style={{ flex: "none", font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-muted)", background: "var(--sunken)", borderRadius: 8, padding: "3px 7px" }}>OFF SALE</span>}
                </div>
                <div className="bq-meta">
                  {fmt(p.price)} EGP · {p.kind === "bundle" ? `${p.credits} classes${p.sharedSeats ? ` shared by ${p.sharedSeats}` : ""} · ` : "all classes · "}
                  {p.durationMonths} month{p.durationMonths === 1 ? "" : "s"}
                  {p.invitationsAllowance > 0 ? ` · ${p.invitationsAllowance} guest pass${p.invitationsAllowance === 1 ? "" : "es"}` : ""}
                </div>
              </div>
              <button className="bq-hit" onClick={() => setEditing({ kind, planType: p })} aria-label={`Edit ${p.name}`} style={iconBtn()}>
                <Icon name="pencil" size={15} />
              </button>
              <button className="bq-hit" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`} style={iconBtn(true)}>
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

export function PlanTypeSheet({ open, kind: kindProp, planType: planTypeProp, onClose }: { open: boolean; kind: GroupPlanTypeKind; planType: GroupPlanType | null; onClose: () => void }) {
  const mounted = useMountedThroughExit(open);
  const kind = useFrozen(open, kindProp);
  const planType = useFrozen(open, planTypeProp);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [months, setMonths] = useState("1");
  const [credits, setCredits] = useState("");
  const [invitations, setInvitations] = useState("");
  const [shared, setShared] = useState("1");
  const [onSale, setOnSale] = useState<"on" | "off">("on");
  const { orgMode: sheetMode } = useAuth();
  const sheetSolo = sheetMode === "solo";
  const [locationId, setLocationId] = useState<string | null>(null);
  const locations = useLocations();
  const { current } = useCurrentLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose, { quiet: true });
  const isBundle = kind === "bundle";

  useEffect(() => {
    if (open) {
      setName(planType?.name ?? "");
      setPrice(planType ? String(planType.price) : "");
      setMonths(String(planType?.durationMonths ?? 1));
      setCredits(planType?.credits != null ? String(planType.credits) : "");
      setInvitations(planType ? String(planType.invitationsAllowance) : "");
      setShared(String(planType?.sharedSeats ?? 1));
      setOnSale(planType && !planType.active ? "off" : "on");
      setLocationId(planType ? (planType.locationId ?? null) : (current?.id ?? null));
      setError(null);
    }
    // Deliberate: Reset the form when the sheet opens or its subject changes; the default location is read at that moment (a late-arriving location must not wipe the form).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, planType]);

  if (!mounted) return null;

  const save = async () => {
    const priceNum = Number(price);
    const creditsNum = Number(credits);
    const invitesNum = invitations === "" ? 0 : Number(invitations);
    if (!name.trim()) return setError("Give it a name.");
    if (price === "" || !Number.isFinite(priceNum) || priceNum < 0) return setError("Enter a price.");
    if (isBundle && (!Number.isInteger(creditsNum) || creditsNum < 1)) return setError("Enter how many classes the bundle includes.");
    if (!Number.isInteger(invitesNum) || invitesNum < 0) return setError("Guest passes must be a whole number, 0 or more.");
    if (locations.length > 0 && !locationId) return setError("Choose the location it's for.");
    const seats = isBundle ? Number(shared) : 1;
    if (seats > 1 && creditsNum % seats !== 0) return setError(`${creditsNum} classes can't be split evenly between ${seats} people.`);
    const input = { kind, name: name.trim(), price: priceNum, durationMonths: Number(months), credits: isBundle ? creditsNum : null, invitationsAllowance: invitesNum, sharedSeats: seats > 1 ? seats : null, ...(locations.length > 0 ? { locationId } : {}) };
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
          <div className="bq-label">{planType ? `EDIT ${noun.toUpperCase()}` : isBundle ? "NEW CLASS BUNDLE" : "NEW MEMBERSHIP"}</div>
          <div className="bq-title">{planType ? planType.name : isBundle ? "New bundle" : "New membership"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder={isBundle ? "10-Class Pack" : "All-Access · 3 Months"} />
            <TextField label="PRICE · EGP" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <LocationField locations={locations} value={locationId} onChange={setLocationId} />
            {isBundle && <TextField label="CLASSES INCLUDED" type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="10" />}
            {isBundle && (
              <SelectField label="SHARED BY" value={shared} onChange={setShared} options={[{ value: "1", label: "One person" }, { value: "2", label: "2 people" }, { value: "3", label: "3 people" }, { value: "4", label: "4 people" }]} />
            )}
            {isBundle && Number(shared) > 1 && (
              <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", marginTop: -4 }}>
                {Number(credits) > 0 && Number(credits) % Number(shared) === 0 ? `Each person gets ${Number(credits) / Number(shared)} classes and ${fmt(Number(price) / Number(shared))} EGP of the price, valid for the months below.` : "Classes and price are split evenly. Classes must divide evenly."} Sold at the desk to everyone at once.
              </div>
            )}
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
            <div  className="bq-error bq-error--spaced bq-rise">{error}</div>
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

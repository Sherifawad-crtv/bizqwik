import { CategoryPill } from "../../shared/category";
import { useFrozen, useMountedThroughExit } from "../../shared/useLatch";
import { LocationField, LocationPill, atLocation, useCurrentLocation, useLocations } from "../../shared/locations";
import { EmptyState } from "../../design-system/components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../shared/api/useAsync";
import { useLatch } from "../../shared/useLatch";
import { api } from "../../shared/api/backend";
import type { BundleType } from "../../shared/types";
import { Segmented } from "../../design-system/components/Segmented";
import { Button } from "../../design-system/components/Button";
import { Sheet } from "../../design-system/components/Sheet";
import { ConfirmSheet } from "../../design-system/components/ConfirmSheet";
import { TextField } from "../../design-system/components/FormField";
import { Spinner } from "../../design-system/components/Spinner";
import { SheetSuccessIcon } from "../../design-system/components/SheetSuccessIcon";
import { useSheetSuccess } from "../../design-system/components/useSheetSuccess";
import { useAuth } from "../../shared/auth";
import { MotionList } from "../../design-system/components/MotionList";
import { IconButton } from "../../design-system/components/IconButton";
import "./BundlesPanel.css";

export function BundlesPanel() {
  const { data: raw } = useAsync(() => api.bundleTypes(), []);
  const locations = useLocations();
  const { current: bundlesHere } = useCurrentLocation();
  // With 2+ locations: only the selected location's PT bundles.
  const data = raw ? { bundleTypes: raw.bundleTypes.filter((b) => atLocation(b.locationId, locations.length > 1 ? (bundlesHere?.id ?? null) : null)) } : null;
  const [editing, setEditing] = useState<BundleType | "new" | null>(null);
  const [deleting, setDeleting] = useState<BundleType | null>(null);
  const shownDeleting = useLatch(deleting);

  if (!data) return <Spinner />;
  // Packages taken off sale are gone from the list; people who hold one keep it.
  const rows = data.bundleTypes.filter((b) => b.active !== false);

  return (
    <div>
      <div className="bq-flex bq-items-center bq-gap-10px bq-mb-14px">
        <span className="bq-h2">Private training bundles</span>
        <span className="bq-meta">{rows.length}</span>
        <Button className="bq-catalog-bundles-panel-btn" size="md" onClick={() => setEditing("new")}>
          + New bundle
        </Button>
      </div>

      <div className="bq-panel">
        <MotionList>
{rows.map((b, i) => (
          <div key={b.id} className={`bq-listrow ${!(i === rows.length - 1) ? "bq-listrow--divider" : ""}`}>
            <div className="bq-grow">
              <div className="bq-flex bq-items-center bq-gap-2">
                <span className="bq-h3">{b.name}</span>
                <CategoryPill name={b.name} />
                <LocationPill locations={locations} id={b.locationId} />
              </div>
              <div className="bq-meta">
                {b.price} EGP · {b.sessionsIncluded} sessions · {b.expiryDays >= NO_EXPIRY_DAYS ? "no expiry" : `${b.expiryDays} days`}
              </div>
            </div>
            <IconButton icon="pencil" label="Edit bundle" onClick={() => setEditing(b)} />
            <IconButton icon="trash" label="Delete bundle" tone="danger" onClick={() => setDeleting(b)} />
          </div>
        ))}
</MotionList>
        {rows.length === 0 && (
          <EmptyState bare icon="coaches" title="No PT bundles yet" body="A PT bundle is a pack of private sessions with one coach (e.g. 8 sessions, valid 30 days). The front desk sells them once they exist." action={{ label: "+ New PT bundle", onClick: () => setEditing("new") }} />
        )}
      </div>

      <BundleSheet open={editing !== null} bundleType={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      {shownDeleting && (
        <ConfirmSheet
          open={!!deleting}
          onClose={() => setDeleting(null)}
          kicker="DELETE BUNDLE"
          title={`Delete ${shownDeleting.name}?`}
          sub="Existing sold packages keep their own snapshot — this only removes it from future sales."
          confirmLabel="Delete bundle"
          danger
          onConfirm={async () => {
            await api.deleteBundleType(shownDeleting.id);
          }}
        />
      )}
    </div>
  );
}

// A PT bundle with no stated validity has no expiry: stored as ten years.
export const NO_EXPIRY_DAYS = 3650;

export function BundleSheet({ open, bundleType: bundleTypeProp, onClose }: { open: boolean; bundleType: BundleType | null; onClose: () => void }) {
  const mounted = useMountedThroughExit(open);
  const bundleType = useFrozen(open, bundleTypeProp);
  const [name, setName] = useState(bundleType?.name ?? "");
  const [price, setPrice] = useState(String(bundleType?.price ?? ""));
  const [sessionsIncluded, setSessionsIncluded] = useState(String(bundleType?.sessionsIncluded ?? ""));
  const [expiryDays, setExpiryDays] = useState(String(bundleType?.expiryDays ?? ""));
  const [locationId, setLocationId] = useState<string | null>(null);
  const [onSale, setOnSale] = useState<"on" | "off">("on");
  const { orgMode: bundleMode } = useAuth();
  const bundleSolo = bundleMode === "solo";
  const locations = useLocations();
  const { current } = useCurrentLocation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose, { quiet: true });

  useEffect(() => {
    if (open) {
      setName(bundleType?.name ?? "");
      setPrice(String(bundleType?.price ?? ""));
      setSessionsIncluded(String(bundleType?.sessionsIncluded ?? ""));
      setExpiryDays(bundleType && bundleType.expiryDays < NO_EXPIRY_DAYS ? String(bundleType.expiryDays) : "");
      setLocationId(bundleType ? (bundleType.locationId ?? null) : (current?.id ?? null));
      setOnSale(bundleType && bundleType.active === false ? "off" : "on");
      setError(null);
    }
    // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bundleType]);

  if (!mounted) return null;

  const save = async () => {
    const priceNum = Number(price);
    const sessionsNum = Number(sessionsIncluded);
    // Solo: leave the expiry blank when the package has none.
    const noExpiry = bundleSolo && expiryDays.trim() === "";
    const expiryNum = noExpiry ? NO_EXPIRY_DAYS : Number(expiryDays);
    if (!name.trim() || !Number.isFinite(priceNum) || priceNum <= 0 || !Number.isInteger(sessionsNum) || sessionsNum <= 0 || !Number.isInteger(expiryNum) || expiryNum <= 0) {
      setError(bundleSolo ? "Enter a name, a price and whole-number sessions (and whole-number days if it expires)." : "Enter a name, a price, whole-number sessions, and whole-number expiry days — all greater than 0.");
      return;
    }
    if (locations.length > 0 && !locationId) {
      setError("Choose the location it's for.");
      return;
    }
    const loc = locations.length > 0 ? locationId : undefined;
    setBusy(true);
    setError(null);
    try {
      if (bundleType) await api.updateBundleType(bundleType.id, name.trim(), priceNum, sessionsNum, expiryNum, loc, onSale === "on");
      else await api.createBundleType(name.trim(), priceNum, sessionsNum, expiryNum, loc);
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={bundleType ? "Bundle updated" : "Bundle created"} iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">{bundleType ? "EDIT BUNDLE" : "NEW BUNDLE"}</div>
          <div className="bq-title">{bundleType ? bundleType.name : "New bundle"}</div>
          <div className="bq-stack">
            <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="24-Session Pack" />
            <TextField label="PRICE · EGP" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
            <LocationField locations={locations} value={locationId} onChange={setLocationId} />
            <TextField label="SESSIONS INCLUDED" type="number" min={1} value={sessionsIncluded} onChange={(e) => setSessionsIncluded(e.target.value)} placeholder="24" />
            <TextField label={bundleSolo ? "EXPIRES AFTER · DAYS (BLANK = NO EXPIRY)" : "EXPIRES AFTER · DAYS"} type="number" min={1} value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} placeholder={bundleSolo ? "No expiry" : "45"} />
            {bundleType && (
              <Segmented value={onSale} onChange={setOnSale} options={[{ value: "on", label: "ON SALE" }, { value: "off", label: "OFF SALE" }]} />
            )}
          </div>
          {error && (
            <div  className="bq-error bq-error--spaced bq-rise">
              {error}
            </div>
          )}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>
            {busy ? "Saving…" : bundleType ? "Save changes" : "Create bundle"}
          </Button>
          <Button className="bq-mt-2" variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

// ---------- Invites ----------

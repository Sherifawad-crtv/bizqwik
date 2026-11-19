import { useState } from "react";
import { useAsync } from "../../shared/api/useAsync";
import { api } from "../../shared/api/backend";
import { fmt } from "../../shared/format";
import { useCurrentLocation } from "../../shared/locations";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Sheet } from "../../design-system/components/Sheet";
import { TextField } from "../../design-system/components/FormField";
import { canvasToDataUrl } from "../../shared/image";
import { useCatalogHere } from "./helpers";
import { IconButton } from "../../design-system/components/IconButton";
import "./Solo.css";

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
export function SoloOffer() {
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

  const card: React.CSSProperties = { background: "var(--color-bg-surface-primary-default)", border: "1px solid var(--color-border-primary-default)", borderRadius: "var(--radius-card)", padding: "16px 20px", marginBottom: 12 };
  return (
    <div className="bq-mb-3">
      <div style={card}>
        <div className="bq-flex bq-items-center bq-gap-3">
          <div className="bq-grow">
            <div className="bq-h3">Drop-in{catalogCurrent && catalogHere ? ` · ${catalogCurrent.name}` : ""}</div>
            <div className="bq-meta">
              {catalogHere ? (dropInList.length === 0 ? "Not set" : dropInList.map((o) => `${o.label} ${fmt(o.price)}`).join(" · ") + " EGP") : dropInPrice === null ? "Not set" : `${fmt(dropInPrice)} EGP · one visit`}
            </div>
          </div>
          <Button className="bq-catalog-solo-solo-offer-btn" size="md" variant="secondary" onClick={() => {
            if (catalogHere) setRows(dropInList.length ? dropInList.map((o) => ({ label: o.label, price: String(o.price) })) : [{ label: "Kids", price: "" }, { label: "Adults", price: "" }]);
            else setPrice(dropInPrice === null ? "" : String(dropInPrice));
            setError(null);
            setEditing(true);
          }}>
            {(catalogHere ? dropInList.length === 0 : dropInPrice === null) ? "Set price" : "Edit"}
          </Button>
        </div>
        {editing && catalogHere && (
          <div className="bq-mt-3 bq-flex bq-col bq-gap-10px">
            {rows.map((r, i) => (
              <div className="bq-catalog-solo-solo-offer-grid" key={i}>
                <TextField label="NAME" value={r.label} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Kids" />
                <TextField label="PRICE · EGP" type="number" min={0} inputMode="decimal" value={r.price} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                <IconButton className="bq-mb-6px" icon="trash" label="Remove" tone="danger" onClick={() => setRows(rows.filter((_, j) => j !== i))} />
              </div>
            ))}
            {rows.length < 6 && <Button variant="quiet" onClick={() => setRows([...rows, { label: "", price: "" }])}>+ Another drop-in</Button>}
            <div className="bq-flex bq-gap-2">
              <Button className="bq-flex-1" disabled={busy} onClick={saveList}>{busy ? "Saving…" : "Save"}</Button>
              <Button variant="quiet" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
        {editing && !catalogHere && (
          <div className="bq-mt-3 bq-flex bq-col bq-gap-10px">
            <TextField label="DROP-IN PRICE · EGP" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
            <div className="bq-flex bq-gap-2">
              <Button className="bq-flex-1" disabled={busy} onClick={savePrice}>{busy ? "Saving…" : "Save"}</Button>
              <Button variant="quiet" disabled={busy} onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <div className="bq-flex bq-items-center bq-gap-3">
          {instapayQr && <img className="bq-catalog-solo-solo-offer-img" src={instapayQr} alt="Your InstaPay QR" />}
          <div className="bq-grow">
            <div className="bq-h3">InstaPay QR</div>
            <div className="bq-meta">{instapayQr ? "Shown when someone pays by InstaPay" : "Add it to show on drop-ins"}</div>
          </div>
          <label className="bq-catalog-solo-solo-offer-label">
            {instapayQr ? "Replace" : "Add QR"}
            <input type="file" accept="image/*" hidden onChange={(e) => { void pickQr(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        </div>
      </div>
      <div style={card}>
        <div className="bq-flex bq-items-center bq-gap-3">
          <div className="bq-grow">
            <div className="bq-h3">InstaPay address</div>
            <div className="bq-catalog-solo-solo-offer-meta">{instapayAddress ?? "Members copy this to pay you"}</div>
          </div>
          {address === null && (
            <Button className="bq-catalog-solo-solo-offer-btn" size="md" variant="secondary" onClick={() => { setAddress(instapayAddress ?? ""); setError(null); }}>
              {instapayAddress ? "Edit" : "Add"}
            </Button>
          )}
        </div>
        {address !== null && (
          <div className="bq-mt-3 bq-flex bq-col bq-gap-10px">
            <TextField label="INSTAPAY ADDRESS" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="name@instapay" autoCapitalize="none" autoCorrect="off" />
            <div className="bq-flex bq-gap-2">
              <Button className="bq-flex-1" disabled={busy} onClick={saveAddress}>{busy ? "Saving…" : "Save"}</Button>
              <Button variant="quiet" disabled={busy} onClick={() => setAddress(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
      {error && <div className="bq-rise bq-catalog-solo-solo-offer-text">{error}</div>}
    </div>
  );
}

/** The places she works. Every session, plan and PT bundle belongs to one. */
export function LocationsCard() {
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
    <div className="bq-mb-3">
      <div className="bq-card bq-catalog-solo-locations-card-spacing">
        <div className="bq-flex bq-items-center bq-gap-3" style={{ marginBottom: list.length ? 8 : 0 }}>
          <div className="bq-grow">
            <div className="bq-h3">Locations</div>
            <div className="bq-meta">{list.length === 0 ? "Working in more than one place? Add them." : "Each plan, PT bundle and session belongs to one."}</div>
          </div>
          {list.length < 10 && (
            <Button className="bq-catalog-solo-solo-offer-btn" size="md" variant="secondary" onClick={() => { setError(null); setEditing({ id: null, name: "" }); }}>
              + Location
            </Button>
          )}
        </div>
        {list.map((l) => (
          <div className="bq-catalog-solo-locations-card-row" key={l.id}>
            <Icon name="map-pin" size={16} />
            <span className="bq-catalog-solo-locations-card-text">{l.name}</span>
            <IconButton icon="pencil" label={`Rename ${l.name}`} onClick={() => { setError(null); setEditing({ id: l.id, name: l.name }); }} />
          </div>
        ))}
      </div>
      <Sheet open={editing !== null} onClose={busy ? () => {} : () => setEditing(null)}>
        <div className="bq-label">{editing?.id ? "RENAME LOCATION" : "NEW LOCATION"}</div>
        <div className="bq-title bq-rise">{editing?.id ? "Rename" : "Add a location"}</div>
        <TextField label="NAME" value={editing?.name ?? ""} onChange={(e) => setEditing((x) => (x ? { ...x, name: e.target.value } : x))} placeholder="e.g. Zamalek studio" />
        {error && <div  className="bq-error bq-error--spaced">{error}</div>}
        <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
        <Button className="bq-mt-2" variant="secondary" fullWidth disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
      </Sheet>
    </div>
  );
}

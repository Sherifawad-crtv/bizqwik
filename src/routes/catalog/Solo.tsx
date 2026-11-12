import { useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import { fmt } from "../../lib/format";
import { useCurrentLocation } from "../../lib/locations";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { TextField } from "../../components/FormField";
import { canvasToDataUrl } from "../../lib/image";
import { iconBtn, useCatalogHere } from "./shared";

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

  const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 20px", marginBottom: 12 };
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={card}>
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
                <button className="bq-hit" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))} style={{ ...iconBtn(true), marginBottom: 6 }}><Icon name="trash" size={15} /></button>
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

      <div style={card}>
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
      <div style={card}>
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
      {error && <div className="bq-rise" style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px", marginBottom: 12 }}>{error}</div>}
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 20px" }}>
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
        {error && <div className="bq-rise" style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>}
        <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
        <Button variant="secondary" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={() => setEditing(null)}>Cancel</Button>
      </Sheet>
    </div>
  );
}

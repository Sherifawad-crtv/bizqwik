import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/backend";
import { useAsync } from "../../shared/api/useAsync";
import { useCurrentLocation } from "../../shared/locations";
import { fmt } from "../../shared/format";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Spinner } from "../../design-system/components/Spinner";
import { ErrorBanner } from "../../design-system/components/ErrorBanner";
import "./SoloDropIn.css";

type Method = "cash" | "instapay";

/** The solo owner's drop-in: one price (set on the Plans tab), cash or
 * InstaPay, nothing else. InstaPay shows her QR so the person can pay and be
 * let in straight away. */
export function SoloDropIn({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const settings = useAsync(() => api.orgSettings(), []);
  // With 2+ locations, the price (and the sale) is the current location's.
  const { locations, current } = useCurrentLocation();
  const here = locations.length > 1 ? (current?.id ?? null) : null;
  const [method, setMethod] = useState<Method | null>(null);
  // A location can sell several drop-ins (Kids / Adults): which one.
  const [kind, setKind] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Method | null>(null);

  if (!settings.data) return <Spinner />;
  const options = here ? (settings.data.dropInOptions[here] ?? []) : [];
  const chosen = options.find((o) => o.label === kind) ?? null;
  const price = options.length > 0 ? (chosen?.price ?? null) : here ? (settings.data.dropInPrices[here] ?? null) : settings.data.dropInPrice;
  const qr = settings.data.instapayQr;

  // Kids / Adults: pick which drop-in first.
  if (options.length > 0 && !chosen) {
    return (
      <div>
        <div className="bq-frontdesk-solo-drop-in-label">WHO'S DROPPING IN{current ? ` · ${current.name.toUpperCase()}` : ""}</div>
        <div className="bq-grid bq-gap-10px" style={{ gridTemplateColumns: options.length > 2 ? "1fr" : "1fr 1fr" }}>
          {options.map((o) => (
            <button key={o.label} className="bq-scale bq-frontdesk-solo-drop-in-btn" onClick={() => setKind(o.label)}>
              <div className="bq-frontdesk-solo-drop-in-title">{o.label}</div>
              <div className="bq-frontdesk-solo-drop-in-meta">{fmt(o.price)} EGP</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (price === null) {
    return (
      <div className="bq-frontdesk-solo-drop-in-part">
        <div className="bq-h3">Set {here && current ? `${current.name}'s` : "your"} drop-in price first</div>
        <div className="bq-frontdesk-solo-drop-in-meta-2">It lives with your plans, so you only set it once.</div>
        <Button fullWidth size="lg" onClick={() => navigate("/catalog")}>Go to Plans</Button>
      </div>
    );
  }

  const confirm = async () => {
    if (!method) return;
    setBusy(true);
    setError(null);
    try {
      await api.soloDropIn(method, here, chosen?.label);
      setDone(method);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record the drop-in.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bq-frontdesk-solo-drop-in-part-2">
        <span className="bq-frontdesk-solo-drop-in-row">
          <Icon name="check" size={32} />
        </span>
        <div className="bq-frontdesk-solo-drop-in-title-2">Drop-in recorded</div>
        <div className="bq-frontdesk-solo-drop-in-meta-3">{fmt(price)} EGP · {done === "instapay" ? "InstaPay" : "Cash"}</div>
        <Button fullWidth size="lg" onClick={onDone}>Done</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="bq-text-center bq-mb-4">
        <div className="bq-frontdesk-solo-drop-in-title-3">{fmt(price)}</div>
        <div className="bq-frontdesk-solo-drop-in-label-2">EGP · {chosen ? `${chosen.label.toUpperCase()} DROP-IN` : "ONE DROP-IN"}{here && current ? ` · ${current.name.toUpperCase()}` : ""}</div>
      </div>

      {!method && (
        <div className="bq-frontdesk-solo-drop-in-grid">
          {(["cash", "instapay"] as const).map((m) => (
            <button
              key={m}
              className="bq-scale bq-frontdesk-solo-drop-in-btn-2"
              onClick={() => setMethod(m)}
            >
              {m === "cash" ? "Cash" : "InstaPay"}
            </button>
          ))}
        </div>
      )}

      {method === "instapay" && (
        <div className="bq-text-center">
          {qr ? (
            <img className="bq-frontdesk-solo-drop-in-img" src={qr} alt="InstaPay QR code" />
          ) : (
            <div className="bq-frontdesk-solo-drop-in-meta-4">
              Add your InstaPay QR on the Plans tab to show it here.
              <div><button className="bq-frontdesk-solo-drop-in-btn-3" onClick={() => navigate("/catalog")}>Add QR</button></div>
            </div>
          )}
        </div>
      )}

      {method && (
        <>
          {error && <ErrorBanner text={error} />}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={confirm}>
            {busy ? "Saving…" : method === "instapay" ? "Payment received" : "Cash received"}
          </Button>
          <Button className="bq-mt-2" variant="quiet" fullWidth disabled={busy} onClick={() => setMethod(null)}>Back</Button>
        </>
      )}
    </div>
  );
}

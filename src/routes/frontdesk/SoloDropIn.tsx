import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { useCurrentLocation } from "../../lib/locations";
import { fmt } from "../../lib/format";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { ErrorBanner } from "./shared";

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
        <div style={{ font: "700 12px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", textAlign: "center", marginBottom: 12 }}>WHO'S DROPPING IN{current ? ` · ${current.name.toUpperCase()}` : ""}</div>
        <div style={{ display: "grid", gridTemplateColumns: options.length > 2 ? "1fr" : "1fr 1fr", gap: 10 }}>
          {options.map((o) => (
            <button key={o.label} data-tap onClick={() => setKind(o.label)} style={{ minHeight: 84, borderRadius: "var(--r-input)", border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer", padding: 12 }}>
              <div style={{ font: "800 18px var(--font-body)" }}>{o.label}</div>
              <div style={{ font: "700 14px var(--font-mono)", color: "var(--primary-pressed)", marginTop: 2 }}>{fmt(o.price)} EGP</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (price === null) {
    return (
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div style={{ font: "700 16px var(--font-body)" }}>Set {here && current ? `${current.name}'s` : "your"} drop-in price first</div>
        <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)", margin: "6px 0 16px" }}>It lives with your plans, so you only set it once.</div>
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
      <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
        <span style={{ width: 64, height: 64, borderRadius: 999, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paid-bg)", color: "var(--paid-fg)" }}>
          <Icon name="check" size={32} />
        </span>
        <div style={{ font: "800 24px var(--font-body)" }}>Drop-in recorded</div>
        <div style={{ font: "400 14px var(--font-mono)", color: "var(--ink-muted)", margin: "4px 0 18px" }}>{fmt(price)} EGP · {done === "instapay" ? "InstaPay" : "Cash"}</div>
        <Button fullWidth size="lg" onClick={onDone}>Done</Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ font: "800 48px/1.05 var(--font-body)", letterSpacing: "-.03em" }}>{fmt(price)}</div>
        <div style={{ font: "700 12px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", marginTop: 4 }}>EGP · {chosen ? `${chosen.label.toUpperCase()} DROP-IN` : "ONE DROP-IN"}{here && current ? ` · ${current.name.toUpperCase()}` : ""}</div>
      </div>

      {!method && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {(["cash", "instapay"] as const).map((m) => (
            <button
              key={m}
              data-tap
              onClick={() => setMethod(m)}
              style={{ height: 64, borderRadius: "var(--r-input)", border: "1px solid var(--line)", background: "var(--surface)", font: "700 16px var(--font-body)", cursor: "pointer" }}
            >
              {m === "cash" ? "Cash" : "InstaPay"}
            </button>
          ))}
        </div>
      )}

      {method === "instapay" && (
        <div style={{ textAlign: "center" }}>
          {qr ? (
            <img src={qr} alt="InstaPay QR code" style={{ width: "100%", maxWidth: 280, aspectRatio: "1", objectFit: "contain", background: "#fff", borderRadius: 16, border: "1px solid var(--line)" }} />
          ) : (
            <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)", background: "var(--sunken)", borderRadius: 14, padding: "14px 16px" }}>
              Add your InstaPay QR on the Plans tab to show it here.
              <div><button onClick={() => navigate("/catalog")} style={{ border: 0, background: "none", color: "var(--primary-pressed)", font: "700 14px var(--font-body)", cursor: "pointer", padding: "8px 0 0" }}>Add QR</button></div>
            </div>
          )}
        </div>
      )}

      {method && (
        <>
          {error && <ErrorBanner text={error} />}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={confirm}>
            {busy ? "Saving…" : method === "instapay" ? "Payment received" : "Cash received"}
          </Button>
          <Button variant="quiet" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={() => setMethod(null)}>Back</Button>
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import { fmt } from "../../lib/format";
import type { ClientWithPackage } from "../../lib/types";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { TextField } from "../../components/FormField";
import { PaymentSelect } from "../../components/PaymentSelect";
import { Icon } from "../../components/Icon";
import { Card, ClientPicker, ErrorBanner } from "./shared";
import { useFrontDeskCatalog } from "./Members";
import type { PayMethod } from "../../lib/types";

export function DropIn() {
  useSetHeader({ kicker: "FRONT DESK", title: "Drop-In" }, []);
  const [params, setParams] = useSearchParams();
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  // The linked client lives in the URL so a check-in hand-off
  // (?client=…&name=…) survives the tab transition's remount.
  const clientId = params.get("client");
  const client = clientId ? { id: clientId, name: params.get("name") ?? "Client" } : null;
  const setClient = (c: { id: string; name: string } | null) => setParams(c ? { client: c.id, name: c.name } : {}, { replace: true });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Wallet is only payable when a member is linked; a walk-in has no wallet.
  const effectivePay: PayMethod = !client && payMethod === "wallet" ? "cash" : payMethod;

  const submit = async () => {
    const amount = Number(price);
    if (!category.trim()) {
      setError("Enter what the drop-in is for.");
      return;
    }
    if (price === "" || !Number.isFinite(amount) || amount < 0) {
      setError("Enter the price paid.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.dropIn(client?.id ?? null, category.trim(), amount, effectivePay);
      setDone(`${client ? client.name : "Walk-in"} · ${category.trim()} · ${fmt(amount)} EGP`);
      setCategory("");
      setPrice("");
      setClient(null);
      setPayMethod("cash");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Card style={{ padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ color: "var(--primary-pressed)", display: "flex", marginTop: 2 }}>
          <Icon name="ticket" size={22} />
        </span>
        <div>
          <div style={{ font: "700 16px var(--font-body)" }}>One-time entry</div>
          <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)" }}>Valid for a single session. Link a client if they have a record, or leave it as a walk-in.</div>
        </div>
      </Card>

      {done && (
        <div style={{ marginBottom: 14, font: "600 13px/1.5 var(--font-body)", color: "var(--paid-fg)", background: "var(--paid-bg)", borderRadius: 14, padding: "10px 14px" }}>
          Drop-in recorded — {done}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TextField
          label="SESSION"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setDone(null);
          }}
          placeholder="e.g. Calisthenics"
          autoComplete="off"
        />
        <TextField label="PRICE PAID · EGP" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />

        <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>CLIENT (OPTIONAL)</div>
            <div style={{ font: "600 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client ? client.name : "Walk-in"}</div>
          </div>
          {client ? (
            <Button variant="quiet" size="md" style={{ height: 36, padding: "0 12px" }} onClick={() => setClient(null)}>
              Remove
            </Button>
          ) : (
            <Button variant="secondary" size="md" style={{ height: 36, padding: "0 12px" }} onClick={() => setPickerOpen(true)}>
              Link client
            </Button>
          )}
        </div>

        <PaymentSelect value={effectivePay} onChange={setPayMethod} wallet={!!client} />
      </div>

      {error && <ErrorBanner text={error} />}
      <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={submit}>
        {busy ? "Saving…" : "Confirm drop-in"}
      </Button>
      <div style={{ textAlign: "center", font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 10 }}>Take payment at the desk before confirming.</div>

      <PickClientSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(c) => {
          setClient({ id: c.id, name: c.name });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function PickClientSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: ClientWithPackage) => void }) {
  const { data } = useAsync(() => (open ? api.clients() : Promise.resolve(null)), [open]);
  const { membershipTypes, bundleTypes } = useFrontDeskCatalog();
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>DROP-IN</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Link a client</div>
      <ClientPicker clients={data?.clients ?? []} membershipTypes={membershipTypes} bundleTypes={bundleTypes} onPick={onPick} />
      <Button variant="quiet" fullWidth style={{ marginTop: 10 }} onClick={onClose}>
        Cancel
      </Button>
    </Sheet>
  );
}

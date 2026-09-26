import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { ApiError, api } from "../../lib/backend";
import { fmt } from "../../lib/format";
import { whenLabel } from "../../lib/classTime";
import type { ClientWithPackage } from "../../lib/types";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { Segmented } from "../../components/Segmented";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { TextField, SelectField } from "../../components/FormField";
import { PaymentSelect } from "../../components/PaymentSelect";
import { Icon } from "../../components/Icon";
import { Card, ClientPicker, ErrorBanner } from "./shared";
import { useFrontDeskCatalog } from "./Members";
import type { PayMethod } from "../../lib/types";

type Mode = "class" | "walkin";

/** Pay-per-visit at the desk. "Class" puts a member into one class session at
 * its drop-in price (they land on the roster); "Walk-in" is a free-form entry
 * like open gym. Both are always recorded against a member — a walk-in can
 * link an existing client or add a new one (name, phone, email) on the spot,
 * so the visit lands in their history and they can sign up to the app. A
 * member who still has a group plan running gets the same "are you sure?"
 * check as the member app before being charged. */
export function DropIn() {
  useSetHeader({ kicker: "FRONT DESK", title: "Drop-In" }, []);
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>("class");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [classId, setClassId] = useState("");
  // The linked client lives in the URL so a check-in hand-off
  // (?client=…&name=…) survives the tab transition's remount.
  const clientId = params.get("client");
  const client = clientId ? { id: clientId, name: params.get("name") ?? "Client" } : null;
  const setClient = (c: { id: string; name: string } | null) => setParams(c ? { client: c.id, name: c.name } : {}, { replace: true });
  const [pickerOpen, setPickerOpen] = useState(false);
  // Walk-in for someone who isn't a client yet: their details, sent with the sale.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);

  const classes = useAsync(() => api.classes(), []);
  const now = Date.now();
  const sessions = (classes.data?.classes ?? []).filter(
    (c) => c.status === "active" && Date.parse(c.startsAt) >= now - 2 * 60 * 60 * 1000 && Date.parse(c.startsAt) <= now + 7 * 86400000,
  );
  const session = sessions.find((c) => c.id === classId) ?? null;

  // Wallet is only payable for a linked member; a brand-new one has no wallet.
  const effectivePay: PayMethod = !client && payMethod === "wallet" ? "cash" : payMethod;
  const newMember = mode === "walkin" && !client && adding;

  const reset = () => {
    setCategory("");
    setPrice("");
    setClassId("");
    setClient(null);
    setPayMethod("cash");
    setAdding(false);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
  };

  // Records the sale; throws on failure. `confirmed` re-sends after the desk
  // has acknowledged the member's running plan.
  const perform = async (confirmed: boolean) => {
    if (mode === "class" && client && session) {
      await api.classDropIn(client.id, session.id, effectivePay, confirmed);
      setDone(`${client.name} · ${session.title} · ${fmt(session.price)} EGP`);
    } else {
      const member = client ? { clientId: client.id } : { newClient: { name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim().toLowerCase() } };
      await api.dropIn(member, category.trim(), Number(price), effectivePay, confirmed);
      setDone(`${client ? client.name : `${newName.trim()} (new member · app invite ready)`} · ${category.trim()} · ${fmt(Number(price))} EGP`);
    }
    reset();
  };

  const submit = async () => {
    setError(null);
    if (mode === "class") {
      if (!client) return setError("Link the member first — a class drop-in puts them on the roster.");
      if (!session) return setError("Choose the class session.");
    } else {
      if (!client && !adding) return setError("Link the member or add their details — every walk-in is recorded against a member.");
      if (newMember) {
        if (!newName.trim() || !newPhone.trim()) return setError("Enter the member's name and phone number.");
        if (!/^\S+@\S+\.\S+$/.test(newEmail.trim())) return setError("Enter the member's email — they sign in to the app with it.");
      }
      if (!category.trim()) return setError("Enter what the drop-in is for.");
      const amount = Number(price);
      if (price === "" || !Number.isFinite(amount) || amount < 0) return setError("Enter the price paid.");
    }
    setBusy(true);
    try {
      await perform(false);
    } catch (err) {
      if (err instanceof ApiError && err.code === "active_plan_confirm") {
        setConfirmPlan(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <Segmented
          value={mode}
          onChange={(v) => {
            setMode(v);
            setError(null);
            setDone(null);
          }}
          options={[
            { value: "class", label: "CLASS SESSION" },
            { value: "walkin", label: "WALK-IN" },
          ]}
        />
      </div>

      <Card style={{ padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ color: "var(--primary-pressed)", display: "flex", marginTop: 2 }}>
          <Icon name={mode === "class" ? "calendar" : "ticket"} size={22} />
        </span>
        <div>
          <div style={{ font: "700 16px var(--font-body)" }}>{mode === "class" ? "Drop into a class" : "One-time entry"}</div>
          <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)" }}>
            {mode === "class"
              ? "Charges that class's drop-in price and adds the member to its roster as arrived."
              : "Valid for a single visit. Link the member, or add a new one with their details."}
          </div>
        </div>
      </Card>

      {done && (
        <div style={{ marginBottom: 14, font: "600 13px/1.5 var(--font-body)", color: "var(--paid-fg)", background: "var(--paid-bg)", borderRadius: 14, padding: "10px 14px" }}>
          Drop-in recorded — {done}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>MEMBER</div>
            <div style={{ font: "600 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{client ? client.name : newMember ? "New member" : "Not linked"}</div>
          </div>
          {client || newMember ? (
            <Button
              variant="quiet"
              size="md"
              style={{ height: 36, padding: "0 12px" }}
              onClick={() => {
                setClient(null);
                setAdding(false);
              }}
            >
              {client ? "Remove" : "Cancel"}
            </Button>
          ) : (
            <>
              {mode === "walkin" && (
                <Button variant="quiet" size="md" style={{ height: 36, padding: "0 12px" }} onClick={() => setAdding(true)}>
                  New member
                </Button>
              )}
              <Button variant="secondary" size="md" style={{ height: 36, padding: "0 12px" }} onClick={() => setPickerOpen(true)}>
                Link member
              </Button>
            </>
          )}
        </div>

        {newMember && (
          <>
            <TextField label="FULL NAME" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Member name" autoComplete="off" />
            <TextField label="PHONE" type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="01xxxxxxxxx" autoComplete="off" />
            <TextField label="EMAIL" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" />
          </>
        )}

        {mode === "class" ? (
          <>
            <SelectField
              label="CLASS SESSION"
              value={classId}
              onChange={(v) => {
                setClassId(v);
                setDone(null);
              }}
              placeholder="Choose a session (next 7 days)"
              options={sessions.map((c) => ({ value: c.id, label: `${c.title} · ${whenLabel(c.startsAt)} · ${fmt(c.price)} EGP` }))}
              empty={{ title: "No class sessions in the next 7 days", body: "Classes are scheduled by the department head in Catalog → Classes. For a visit that isn't a class, use Walk-in." }}
            />
            {session && (
              <div style={{ font: "600 14px var(--font-body)", padding: "0 4px" }}>
                Drop-in price: <span className="tabular">{fmt(session.price)} EGP</span>
              </div>
            )}
          </>
        ) : (
          <>
            <TextField
              label="SESSION"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setDone(null);
              }}
              placeholder="e.g. Open gym"
              autoComplete="off"
            />
            <TextField label="PRICE PAID · EGP" type="number" min={0} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </>
        )}

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
          setAdding(false);
          setPickerOpen(false);
        }}
      />

      <ConfirmSheet
        open={confirmPlan !== null}
        onClose={() => setConfirmPlan(null)}
        kicker="PLAN STILL RUNNING"
        title="Charge a drop-in anyway?"
        sub={confirmPlan ?? ""}
        confirmLabel="Yes, charge the drop-in"
        onConfirm={() => perform(true)}
      />
    </div>
  );
}

function PickClientSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: ClientWithPackage) => void }) {
  const { data } = useAsync(() => (open ? api.clients() : Promise.resolve(null)), [open]);
  const { bundleTypes } = useFrontDeskCatalog();
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>DROP-IN</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Link a member</div>
      <ClientPicker clients={data?.clients ?? []} bundleTypes={bundleTypes} onPick={onPick} />
      <Button variant="quiet" fullWidth style={{ marginTop: 10 }} onClick={onClose}>
        Cancel
      </Button>
    </Sheet>
  );
}

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetHeader } from "../../../shared/screen/header";
import { useDropIn, useDropInClasses, usePickableClients } from "./hooks/useDropIn";
import { dropInAmount, dropInSessions, effectivePay as payableWith, isNewMember, nextSessionId as firstSessionId, tenderLabel, type DropInMode, type DropInSale } from "../domain/dropIn";
import { fmt } from "../../../shared/format";
import { whenLabel } from "../../../shared/domain/classTime";
import type { ClientWithPackage } from "../../../shared/types";
import { Button } from "../../../design-system/components/Button";
import { Sheet } from "../../../design-system/components/Sheet";
import { Segmented } from "../../../design-system/components/Segmented";
import { ConfirmSheet } from "../../../design-system/components/ConfirmSheet";
import { TextField, SelectField } from "../../../design-system/components/FormField";
import { PaymentSelect } from "../../../shared/components/PaymentSelect";
import { Icon } from "../../../design-system/components/Icon";
import { ClientPicker } from "./shared";
import { ErrorBanner } from "../../../design-system/components/ErrorBanner";
import { Card } from "../../../design-system/components/Card";
import { useNewClient } from "./NewClientModal";
import { useFrontDeskCatalog } from "./hooks/useMembers";
import type { PayMethod } from "../../../shared/types";
import { useNow } from "../../../shared/hooks/useNow";
import "./DropIn.css";

type Mode = DropInMode;

/** Pay-per-visit at the desk. "Class" puts a member into one class session at
 * its drop-in price (they land on the roster); "Walk-in" is a free-form entry
 * like open gym. Both are always recorded against a member — a walk-in can
 * link an existing client or add a new one (name, phone, email) on the spot,
 * so the visit lands in their history and they can sign up to the app. A
 * member who still has a group plan running gets the same "are you sure?"
 * check as the member app before being charged. */
export function DropIn({ embedded = false, initialClient = null }: { embedded?: boolean; initialClient?: { id: string; name: string } | null } = {}) {
  useSetHeader(embedded ? null : { kicker: "FRONT DESK", title: "Drop-In" }, []);
  const [params, setParams] = useSearchParams();
  // In a modal the linked client is plain state; as a page it lives in the URL.
  const [localClient, setLocalClient] = useState<{ id: string; name: string } | null>(initialClient);
  const [mode, setMode] = useState<Mode>("class");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [classId, setClassId] = useState("");
  // The linked client lives in the URL so a check-in hand-off
  // (?client=…&name=…) survives the tab transition's remount.
  const clientId = params.get("client");
  const urlClient = clientId ? { id: clientId, name: params.get("name") ?? "Client" } : null;
  const client = embedded ? localClient : urlClient;
  const setClient = (c: { id: string; name: string } | null) => (embedded ? setLocalClient(c) : setParams(c ? { client: c.id, name: c.name } : {}, { replace: true }));
  const [pickerOpen, setPickerOpen] = useState(false);
  // Walk-in for someone who isn't a client yet: their details, sent with the sale.
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [done, setDone] = useState<string | null>(null);
  const { busy, error, setError, confirmPlan, closeConfirm, submit: charge, chargeAnyway } = useDropIn();

  const classes = useDropInClasses();
  const now = useNow();
  const sessions = dropInSessions(classes.data?.classes ?? [], now);
  const session = sessions.find((c) => c.id === classId) ?? null;
  // Start on the next class (the one most drop-ins are for); the desk can change it.
  const nextSessionId = firstSessionId(sessions, now);
  useEffect(() => {
    if (!classId && nextSessionId) setClassId(nextSessionId);
  }, [nextSessionId, classId]);

  // Wallet is only payable for a linked member; a brand-new one has no wallet.
  const effectivePay: PayMethod = payableWith(payMethod, !!client);
  const sale: DropInSale = { mode, client, session, adding, newName, newPhone, newEmail, category, price, pay: payMethod };
  const newMember = isNewMember(sale);

  // The amount on the button, like a till: what is about to be charged, and how.
  const amount = dropInAmount(sale);
  const tender = tenderLabel(effectivePay);

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

  const recorded = (label: string) => {
    setDone(label);
    reset();
  };
  const submit = () => charge(sale, recorded);

  return (
    <div>
      <div className="bq-flex bq-justify-center bq-mb-4">
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

      <Card className="bq-frontdesk-drop-in-card" pad="none">
        <span className="bq-frontdesk-drop-in-row">
          <Icon name={mode === "class" ? "calendar" : "ticket"} size={22} />
        </span>
        <div>
          <div className="bq-h3">{mode === "class" ? "Drop into a class" : "One-time entry"}</div>
          <div className="bq-frontdesk-drop-in-meta">
            {mode === "class"
              ? "Charges that class's drop-in price and adds the member to its roster as arrived."
              : "Valid for a single visit. Link the member, or add a new one with their details."}
          </div>
        </div>
      </Card>

      {done && (
        <div className="bq-frontdesk-drop-in-text">
          Drop-in recorded — {done}
        </div>
      )}

      <div className="bq-stack">
        <div className="bq-frontdesk-drop-in-row-2">
          <div className="bq-grow">
            <div className="bq-label">MEMBER</div>
            <div className="bq-frontdesk-drop-in-text-2">{client ? client.name : newMember ? "New member" : "Not linked"}</div>
          </div>
          {client || newMember ? (
            <Button className="bq-frontdesk-drop-in-btn"
              variant="quiet"
              size="md"
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
                <Button className="bq-frontdesk-drop-in-btn" variant="quiet" size="md" onClick={() => setAdding(true)}>
                  New member
                </Button>
              )}
              <Button className="bq-frontdesk-drop-in-btn" variant="secondary" size="md" onClick={() => setPickerOpen(true)}>
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
              <div className="bq-frontdesk-drop-in-text-3">
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
      <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={submit}>
        {busy ? "Saving…" : amount !== null ? `Charge ${fmt(amount)} EGP · ${tender}` : "Confirm drop-in"}
      </Button>
      <div className="bq-frontdesk-drop-in-meta-2">Take payment at the desk before confirming.</div>

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
        onClose={closeConfirm}
        kicker="PLAN STILL RUNNING"
        title="Charge a drop-in anyway?"
        sub={confirmPlan ?? ""}
        confirmLabel="Yes, charge the drop-in"
        onConfirm={() => chargeAnyway(sale, recorded)}
      />
    </div>
  );
}

function PickClientSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: ClientWithPackage) => void }) {
  const newClient = useNewClient();
  const { data } = usePickableClients(open);
  const { bundleTypes } = useFrontDeskCatalog();
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="bq-label">DROP-IN</div>
      <div className="bq-title">Link a member</div>
      <ClientPicker clients={data?.clients ?? []} bundleTypes={bundleTypes} onPick={onPick} onCreate={newClient.open} />
      <Button className="bq-mt-2" variant="quiet" fullWidth onClick={onClose}>
        Cancel
      </Button>
      {newClient.modal}
    </Sheet>
  );
}

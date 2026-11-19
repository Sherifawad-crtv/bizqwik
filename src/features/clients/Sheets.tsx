import { useMountedThroughExit } from "../../shared/useLatch";
import { useEffect, useState } from "react";
import { api } from "../../shared/api/backend";
import { egp } from "../../shared/format";
import type { ClientWithPackage, Role } from "../../shared/types";
import { Button } from "../../design-system/components/Button";
import { Avatar } from "../../design-system/components/Avatar";
import { Sheet } from "../../design-system/components/Sheet";
import { TextField } from "../../design-system/components/FormField";
import { PackageStatusPill } from "../../shared/components/PackageStatusPill";
import { SheetSuccessIcon } from "../../design-system/components/SheetSuccessIcon";
import { useSheetSuccess } from "../../design-system/components/useSheetSuccess";
import { daysLeft, groupPlanLine } from "./helpers";
import "./Sheets.css";

export function ClientDetailSheet({
  open,
  client,
  role,
  myId,
  coachName,
  onClose,
}: {
  open: boolean;
  client: ClientWithPackage;
  role: Role;
  myId: string;
  coachName: (id: string | null) => string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "compensate">("view");
  const [compAmount, setCompAmount] = useState("");
  const [compNote, setCompNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLabel, setSuccessLabel] = useState("");
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (open) {
      setMode("view");
      setCompAmount("");
      setCompNote("");
      setError(null);
    }
    // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client.id]);

  const pkg = client.currentPackage;
  const canDeliver = role !== "accountant" && client.assignedCoachId === myId && !!pkg && pkg.status === "active";

  const compensate = async () => {
    const amt = Number(compAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Enter an amount.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.compensateClient(client.id, amt, compNote.trim() || undefined);
      setSuccessLabel("Wallet credited");
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
        <SheetSuccessIcon label={successLabel} iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-flex bq-items-center bq-gap-3 bq-mb-18px">
            <Avatar name={client.name} size={44} />
            <div>
              <div className="bq-clients-sheets-client-detail-sheet-title">{client.name}</div>
              {client.age != null && <div className="bq-meta">Age {client.age}</div>}
            </div>
          </div>

          {mode === "view" && (
            <>
              {client.conditions && (
                <div className="bq-clients-sheets-client-detail-sheet-box">
                  <div className="bq-label">CONDITIONS</div>
                  <div className="bq-clients-sheets-client-detail-sheet-text">{client.conditions}</div>
                </div>
              )}

              <div className="bq-clients-sheets-client-detail-sheet-box">
                <div className="bq-label">COACH</div>
                <div className="bq-clients-sheets-client-detail-sheet-text-2">{coachName(client.assignedCoachId) ?? "Unassigned"}</div>
              </div>

              {role === "dept_head" && (
                <div className="bq-clients-sheets-client-detail-sheet-box">
                  <div className="bq-label">GROUP PLAN</div>
                  {client.groupPlan ? (
                    <>
                      <div className="bq-clients-sheets-client-detail-sheet-text-2">{client.groupPlan.name}</div>
                      <div className="bq-clients-sheets-client-detail-sheet-meta">
                        {groupPlanLine(client.groupPlan)} · {egp(client.groupPlan.priceAtSale)}
                      </div>
                    </>
                  ) : (
                    <div className="bq-clients-sheets-client-detail-sheet-text-3">No active plan</div>
                  )}
                </div>
              )}

              {pkg ? (
                <div className="bq-clients-sheets-client-detail-sheet-box">
                  <div className="bq-flex bq-items-center bq-justify-between bq-mb-6px">
                    <span className="bq-label">CURRENT PACKAGE</span>
                    <PackageStatusPill status={pkg.status} />
                  </div>
                  {pkg.status === "active" && (
                    <div className="bq-clients-sheets-client-detail-sheet-text-4">
                      {pkg.sessionsRemaining} of {pkg.sessionsIncluded} sessions left · {daysLeft(pkg.expiryDate)} days left
                    </div>
                  )}
                  <div className="bq-clients-sheets-client-detail-sheet-meta">
                    {egp(pkg.priceAtSale)} paid · {egp(pkg.coachCutAtSale)} coach cut
                  </div>
                </div>
              ) : (
                <div className="bq-clients-sheets-client-detail-sheet-text-5">No package sold yet.</div>
              )}

              {error && (
                <div className="bq-rise bq-clients-sheets-client-detail-sheet-text-6">
                  {error}
                </div>
              )}

              {canDeliver && (
                <div className="bq-clients-sheets-client-detail-sheet-text-7" data-testid="pt-scan-hint">
                  To log a session, scan the PT code in {client.name.split(" ")[0]}'s app (the + button, or Scan QR).
                </div>
              )}
              {role === "dept_head" && (
                <Button className="bq-mt-2" variant="secondary" fullWidth onClick={() => setMode("compensate")}>
                  Compensate to wallet
                </Button>
              )}
              <Button className="bq-mt-2" variant="quiet" fullWidth onClick={onClose}>
                Close
              </Button>
            </>
          )}

          {mode === "compensate" && (
            <>
              <div className="bq-clients-sheets-client-detail-sheet-label">GOODWILL WALLET CREDIT</div>
              <div className="bq-stack bq-rise">
                <TextField label="AMOUNT (EGP)" value={compAmount} onChange={(e) => setCompAmount(e.target.value)} inputMode="numeric" placeholder="0" />
                <TextField label="NOTE (OPTIONAL)" value={compNote} onChange={(e) => setCompNote(e.target.value)} placeholder="Why you're compensating them" />
              </div>
              <div className="bq-clients-sheets-client-detail-sheet-meta-2">
                Adds store credit to {client.name}'s wallet. They can spend it on classes and desk purchases.
              </div>
              {error && (
                <div  className="bq-error bq-error--spaced">
                  {error}
                </div>
              )}
              <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={compensate}>
                {busy ? "Crediting…" : "Credit wallet"}
              </Button>
              <Button className="bq-mt-2" variant="secondary" fullWidth onClick={() => setMode("view")} disabled={busy}>
                Back
              </Button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/** Mobile-only quick-actions menu — replaces cramming edit/delete icon
 * buttons into the already-tight roster card with a single menu button
 * that opens this choice sheet. */
export function ClientActionSheet({
  open,
  client,
  onClose,
  onEdit,
  onDelete,
}: {
  open: boolean;
  client: ClientWithPackage;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="bq-flex bq-items-center bq-gap-3 bq-mb-18px">
        <Avatar name={client.name} size={38} />
        <div className="bq-stat-sm">{client.name}</div>
      </div>
      <Button fullWidth size="lg" onClick={onEdit}>
        Edit client
      </Button>
      <Button className="bq-mt-2" variant="danger" fullWidth onClick={onDelete}>
        Delete client
      </Button>
      <Button className="bq-mt-2" variant="quiet" fullWidth onClick={onClose}>
        Cancel
      </Button>
    </Sheet>
  );
}

export function ClientEditSheet({ open, client, onClose }: { open: boolean; client: ClientWithPackage; onClose: () => void }) {
  const mounted = useMountedThroughExit(open);
  const [name, setName] = useState(client.name);
  const [age, setAge] = useState(client.age != null ? String(client.age) : "");
  const [conditions, setConditions] = useState(client.conditions ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose, { quiet: true });

  useEffect(() => {
    if (open) {
      setName(client.name);
      setAge(client.age != null ? String(client.age) : "");
      setConditions(client.conditions ?? "");
      setError(null);
    }
  }, [open, client]);

  if (!mounted) return null;

  const save = async () => {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateClient(client.id, name.trim(), age.trim() ? Number(age) : null, conditions.trim() || null);
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
        <SheetSuccessIcon label="Client updated" iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">EDIT CLIENT</div>
          <div className="bq-title">{client.name}</div>
          <div className="bq-stack bq-rise">
            <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
            <TextField label="AGE (OPTIONAL)" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
            <TextField label="CONDITIONS (OPTIONAL)" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Only visible to their coach and heads" />
          </div>
          {error && (
            <div  className="bq-error bq-error--spaced">
              {error}
            </div>
          )}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          <Button className="bq-mt-2" variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

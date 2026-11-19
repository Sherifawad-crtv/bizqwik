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
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
            <Avatar name={client.name} size={44} />
            <div>
              <div style={{ font: "800 22px var(--font-family-body)", letterSpacing: "-.01em" }}>{client.name}</div>
              {client.age != null && <div className="bq-meta">Age {client.age}</div>}
            </div>
          </div>

          {mode === "view" && (
            <>
              {client.conditions && (
                <div style={{ background: "var(--color-bg-surface-secondary-default)", border: "1px solid var(--color-border-primary-default)", borderRadius: "var(--radius-item)", padding: "12px 16px", marginBottom: 10 }}>
                  <div className="bq-label">CONDITIONS</div>
                  <div style={{ font: "600 var(--text-body-size)/1.4 var(--font-family-body)" }}>{client.conditions}</div>
                </div>
              )}

              <div style={{ background: "var(--color-bg-surface-secondary-default)", border: "1px solid var(--color-border-primary-default)", borderRadius: "var(--radius-item)", padding: "12px 16px", marginBottom: 10 }}>
                <div className="bq-label">COACH</div>
                <div style={{ font: "600 var(--text-callout-size) var(--font-family-body)" }}>{coachName(client.assignedCoachId) ?? "Unassigned"}</div>
              </div>

              {role === "dept_head" && (
                <div style={{ background: "var(--color-bg-surface-secondary-default)", border: "1px solid var(--color-border-primary-default)", borderRadius: "var(--radius-item)", padding: "12px 16px", marginBottom: 10 }}>
                  <div className="bq-label">GROUP PLAN</div>
                  {client.groupPlan ? (
                    <>
                      <div style={{ font: "600 var(--text-callout-size) var(--font-family-body)" }}>{client.groupPlan.name}</div>
                      <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)" }}>
                        {groupPlanLine(client.groupPlan)} · {egp(client.groupPlan.priceAtSale)}
                      </div>
                    </>
                  ) : (
                    <div style={{ font: "600 var(--text-body-size) var(--font-family-body)", color: "var(--color-text-tertiary-default)" }}>No active plan</div>
                  )}
                </div>
              )}

              {pkg ? (
                <div style={{ background: "var(--color-bg-surface-secondary-default)", border: "1px solid var(--color-border-primary-default)", borderRadius: "var(--radius-item)", padding: "12px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="bq-label">CURRENT PACKAGE</span>
                    <PackageStatusPill status={pkg.status} />
                  </div>
                  {pkg.status === "active" && (
                    <div style={{ font: "600 var(--text-body-size) var(--font-family-body)", marginBottom: 4 }}>
                      {pkg.sessionsRemaining} of {pkg.sessionsIncluded} sessions left · {daysLeft(pkg.expiryDate)} days left
                    </div>
                  )}
                  <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)" }}>
                    {egp(pkg.priceAtSale)} paid · {egp(pkg.coachCutAtSale)} coach cut
                  </div>
                </div>
              ) : (
                <div style={{ font: "500 var(--text-subheadline-size) var(--font-family-body)", color: "var(--color-text-tertiary-default)", marginBottom: 10 }}>No package sold yet.</div>
              )}

              {error && (
                <div className="bq-rise" style={{ marginBottom: 10, font: "600 var(--text-footnote-size)/1.5 var(--font-family-body)", color: "var(--color-text-status-danger-default)", background: "var(--color-bg-fill-status-danger-default)", borderRadius: "var(--radius-item)", padding: "10px 14px" }}>
                  {error}
                </div>
              )}

              {canDeliver && (
                <div data-testid="pt-scan-hint" style={{ marginTop: 6, font: "500 var(--text-footnote-size)/1.5 var(--font-family-body)", color: "var(--color-text-secondary-default)", background: "var(--color-bg-fill-accent-default)", borderRadius: "var(--radius-item)", padding: "10px 14px" }}>
                  To log a session, scan the PT code in {client.name.split(" ")[0]}'s app (the + button, or Scan QR).
                </div>
              )}
              {role === "dept_head" && (
                <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={() => setMode("compensate")}>
                  Compensate to wallet
                </Button>
              )}
              <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose}>
                Close
              </Button>
            </>
          )}

          {mode === "compensate" && (
            <>
              <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", marginBottom: 10 }}>GOODWILL WALLET CREDIT</div>
              <div className="bq-stack bq-rise">
                <TextField label="AMOUNT (EGP)" value={compAmount} onChange={(e) => setCompAmount(e.target.value)} inputMode="numeric" placeholder="0" />
                <TextField label="NOTE (OPTIONAL)" value={compNote} onChange={(e) => setCompNote(e.target.value)} placeholder="Why you're compensating them" />
              </div>
              <div style={{ marginTop: 8, font: "400 var(--text-caption-1-size)/1.5 var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>
                Adds store credit to {client.name}'s wallet. They can spend it on classes and desk purchases.
              </div>
              {error && (
                <div  className="bq-error bq-error--spaced">
                  {error}
                </div>
              )}
              <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={compensate}>
                {busy ? "Crediting…" : "Credit wallet"}
              </Button>
              <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={() => setMode("view")} disabled={busy}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Avatar name={client.name} size={38} />
        <div className="bq-stat-sm">{client.name}</div>
      </div>
      <Button fullWidth size="lg" onClick={onEdit}>
        Edit client
      </Button>
      <Button variant="danger" fullWidth style={{ marginTop: 8 }} onClick={onDelete}>
        Delete client
      </Button>
      <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose}>
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
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

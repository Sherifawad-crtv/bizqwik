import { useFrozen, useMountedThroughExit } from "../hooks/useLatch";
import { useEffect, useState } from "react";
import { useAsync } from "../api/useAsync";
import { api } from "../api/backend";
import type { Role, Tier } from "../types";
import { ROLE_LABELS, hasTier } from "../types";
import { Button } from "../../design-system/components/Button";
import { Sheet } from "../../design-system/components/Sheet";
import { TextField, SelectField } from "../../design-system/components/FormField";
import { SheetSuccessIcon } from "../../design-system/components/SheetSuccessIcon";
import { useSheetSuccess } from "../../design-system/components/useSheetSuccess";
import "./InviteFlow.css";

/** The invite overlay on its own, for opening from any screen: it loads the
 * pay tiers it needs to offer, then behaves exactly like the Invites tab's. */
const INVITABLE_ROLES: Role[] = ["coach", "head_coach", "dept_head", "accountant", "front_desk"];

export function InviteFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useAsync(() => api.tiers(), [open]);
  return <InviteSheet open={open} tiers={data?.tiers ?? []} onClose={onClose} />;
}

export function InviteSheet({ open, tiers: tiersProp, onClose }: { open: boolean; tiers: Tier[]; onClose: () => void }) {
  const mounted = useMountedThroughExit(open);
  const tiers = useFrozen(open, tiersProp);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("coach");
  const [tierId, setTierId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("coach");
      setTierId("");
      setError(null);
    }
  }, [open]);

  if (!mounted) return null;

  const save = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createInvite(email.trim(), role, hasTier(role) ? tierId || null : null);
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
        <SheetSuccessIcon label="Invite sent" iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">NEW INVITE</div>
          <div className="bq-title">Invite someone</div>
          <div className="bq-stack">
            <TextField label="EMAIL" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@bizqwik.app" />
            <SelectField
              label="ROLE"
              value={role}
              onChange={(v) => setRole(v as Role)}
              options={INVITABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            />
            {hasTier(role) && (
              <SelectField
                label="TIER"
                value={tierId}
                onChange={setTierId}
                options={[{ value: "", label: "No tier yet" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]}
              />
            )}
            {hasTier(role) && tiers.length === 0 && (
              <div className="bq-invite-flow-invite-sheet-meta">
                No pay tiers yet — create one in the Tiers tab, then assign it here or later from People.
              </div>
            )}
          </div>
          {error && (
            <div  className="bq-error bq-error--spaced bq-rise">
              {error}
            </div>
          )}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>
            {busy ? "Sending…" : "Send invite"}
          </Button>
          <Button className="bq-mt-2" variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

// ---------- People ----------

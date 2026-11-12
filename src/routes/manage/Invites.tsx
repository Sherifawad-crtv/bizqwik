import { useFrozen, useMountedThroughExit } from "../../lib/useLatch";
import { EmptyState } from "../../components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useLatch } from "../../lib/useLatch";
import { api } from "../../lib/backend";
import type { Invite, Role, Tier } from "../../lib/types";
import { ROLE_LABELS, hasTier } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { TextField, SelectField } from "../../components/FormField";
import { Spinner } from "../../components/Spinner";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { useSheetSuccess } from "../../lib/useSheetSuccess";

const INVITABLE_ROLES: Role[] = ["coach", "head_coach", "dept_head", "accountant", "front_desk"];

export function InvitesPanel() {
  const { data } = useAsync(() => api.invites(), []);
  const { data: tierData } = useAsync(() => api.tiers(), []);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Invite | null>(null);
  const shownDeleting = useLatch(deleting);

  if (!data) return <Spinner />;
  const tiers = tierData?.tiers ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Pending invites</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{data.invites.length}</span>
        <Button size="md" style={{ marginLeft: "auto", height: 40, padding: "0 16px" }} onClick={() => setOpen(true)}>
          + Invite
        </Button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        {data.invites.map((inv, i) => (
          <div key={inv.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: i === data.invites.length - 1 ? "none" : "1px solid var(--line)" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
                {ROLE_LABELS[inv.role].toUpperCase()}
                {inv.tierId ? ` · ${tiers.find((t) => t.id === inv.tierId)?.name ?? ""}` : ""}
              </div>
            </div>
            <button className="bq-hit" onClick={() => setDeleting(inv)} aria-label="Cancel invite" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: "var(--danger-bg)", color: "var(--danger-fg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {data.invites.length === 0 && (
          <EmptyState bare icon="envelope" title="No pending invites" body="Invite coaches, head coaches, the front desk or an accountant by email. They sign up with that email and appear in People." action={{ label: "+ Invite someone", onClick: () => setOpen(true) }} />
        )}
      </div>

      <InviteSheet open={open} tiers={tiers} onClose={() => setOpen(false)} />
      {shownDeleting && (
        <ConfirmSheet
          open={!!deleting}
          onClose={() => setDeleting(null)}
          kicker="CANCEL INVITE"
          title={`Cancel invite for ${shownDeleting.email}?`}
          confirmLabel="Cancel invite"
          danger
          onConfirm={async () => {
            await api.deleteInvite(shownDeleting.email);
          }}
        />
      )}
    </div>
  );
}

/** The invite overlay on its own, for opening from any screen: it loads the
 * pay tiers it needs to offer, then behaves exactly like the Invites tab's. */
export function InviteFlow({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useAsync(() => api.tiers(), [open]);
  return <InviteSheet open={open} tiers={data?.tiers ?? []} onClose={onClose} />;
}

function InviteSheet({ open, tiers: tiersProp, onClose }: { open: boolean; tiers: Tier[]; onClose: () => void }) {
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
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>NEW INVITE</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Invite someone</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
              <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", padding: "0 2px" }}>
                No pay tiers yet — create one in the Tiers tab, then assign it here or later from People.
              </div>
            )}
          </div>
          {error && (
            <div className="bq-rise" style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
            </div>
          )}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
            {busy ? "Sending…" : "Send invite"}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

// ---------- People ----------

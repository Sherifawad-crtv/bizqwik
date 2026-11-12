import { EmptyState } from "../../components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useLatch } from "../../lib/useLatch";
import { api } from "../../lib/backend";
import type { Profile, Tier } from "../../lib/types";
import { ROLE_LABELS, hasTier } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { SelectField } from "../../components/FormField";
import { Avatar } from "../../components/Avatar";
import { Spinner } from "../../components/Spinner";
import { useAuth } from "../../lib/auth";

export function PeoplePanel() {
  const { profile: me } = useAuth();
  const { data } = useAsync(() => api.profiles(), []);
  const { data: tierData } = useAsync(() => api.tiers(), []);
  const [editing, setEditing] = useState<Profile | null>(null);

  if (!data) return <Spinner />;
  const tiers = tierData?.tiers ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span className="bq-h2">People</span>
        <span className="bq-meta">{data.profiles.length}</span>
      </div>

      <div className="bq-panel">
        {data.profiles.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", border: 0, borderBottom: i === data.profiles.length - 1 ? "none" : "1px solid var(--line)", width: "100%", background: "none", cursor: "pointer", textAlign: "left" }}
        >
            <Avatar name={p.name} size={36} src={p.avatarUrl} />
            <div className="bq-grow">
              <div className="bq-h3">{p.name}</div>
              <div className="bq-meta">
                {ROLE_LABELS[p.role].toUpperCase()}
                {p.tierId ? ` · ${tiers.find((t) => t.id === p.tierId)?.name ?? ""}` : ""}
              </div>
            </div>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
        {data.profiles.length === 0 && (
          <EmptyState bare icon="coaches" title="No one has joined yet" body="People appear here once they accept an invite and sign up. Send invites from the Invites tab." />
        )}
      </div>

      <PersonSheet open={!!editing} profile={editing} tiers={tiers} isSelf={editing?.id === me?.id} onClose={() => setEditing(null)} />
    </div>
  );
}

function PersonSheet({
  open,
  profile,
  tiers,
  isSelf,
  onClose,
}: {
  open: boolean;
  profile: Profile | null;
  tiers: Tier[];
  isSelf?: boolean;
  onClose: () => void;
}) {
  const shown = useLatch(profile);
  const [tierId, setTierId] = useState(profile?.tierId ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && profile) {
      setTierId(profile.tierId ?? "");
      setConfirmRemove(false);
      setError(null);
    }
    // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile]);

  // Only blocks the true "nothing has ever been selected" state — once a
  // profile has been shown, `shown` keeps it so the sheet can close with a
  // real slide-out instead of unmounting the instant `profile` goes null.
  if (!shown) return null;

  const saveTier = async (value: string) => {
    setTierId(value);
    setBusy(true);
    setError(null);
    try {
      await api.assignTier(shown.id, value || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <Avatar name={shown.name} size={44} src={shown.avatarUrl} />
          <div>
            <div style={{ font: "800 22px var(--font-body)", letterSpacing: "-.01em" }}>{shown.name}</div>
            <div className="bq-meta">{shown.email}</div>
          </div>
        </div>

        <div className="bq-stack">
          <div style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px" }}>
            <div className="bq-label">ROLE</div>
            <div style={{ font: "600 16px var(--font-body)" }}>{ROLE_LABELS[shown.role]}</div>
          </div>
          {hasTier(shown.role) && (
            <SelectField
              label="TIER"
              value={tierId}
              onChange={saveTier}
              disabled={busy}
              options={[{ value: "", label: "Not assigned" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]}
            />
          )}
          {hasTier(shown.role) && tiers.length === 0 && (
            <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", padding: "0 2px" }}>
              No pay tiers yet — create one in the Tiers tab to set this person's rate.
            </div>
          )}
        </div>

        {error && (
          <div  className="bq-error bq-error--spaced bq-rise">
            {error}
          </div>
        )}

        {!isSelf && (
          <Button variant="danger" fullWidth style={{ marginTop: 18 }} onClick={() => setConfirmRemove(true)}>
            Remove profile
          </Button>
        )}
        <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose}>
          Close
        </Button>
      </Sheet>

      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        kicker="REMOVE PROFILE"
        title={`Remove ${shown.name}?`}
        sub="They'll lose access to Bizqwik immediately. Their past records stay in the ledger."
        confirmLabel="Remove profile"
        danger
        onConfirm={async () => {
          await api.removeProfile(shown.id);
          onClose();
        }}
      />
    </>
  );
}

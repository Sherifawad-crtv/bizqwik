import { cx } from "../../../design-system/cx";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { useEffect, useState } from "react";
import { useLatch } from "../../../shared/hooks/useLatch";
import type { Profile, Tier } from "../../../shared/types";
import { ROLE_LABELS, hasTier } from "../../../shared/types";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { Sheet } from "../../../design-system/components/Sheet";
import { ConfirmSheet } from "../../../design-system/components/ConfirmSheet";
import { SelectField } from "../../../design-system/components/FormField";
import { Avatar } from "../../../design-system/components/Avatar";
import { Spinner } from "../../../design-system/components/Spinner";
import { useAuth } from "../../../shared/session/auth";
import { tierName } from "../domain/team";
import { usePeople, usePersonActions, useTiers } from "./hooks/useTeam";
import "./People.css";

export function PeoplePanel() {
  const { profile: me } = useAuth();
  const people = usePeople();
  const tierList = useTiers();
  const [editing, setEditing] = useState<Profile | null>(null);

  if (!people) return <Spinner />;
  const tiers = tierList ?? [];

  return (
    <div>
      <div className="bq-flex bq-items-center bq-gap-2 bq-mb-4">
        <span className="bq-h2">People</span>
        <span className="bq-meta">{people.length}</span>
      </div>

      <div className="bq-panel">
        {people.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            className={cx(`bq-plain bq-listrow ${!(i === people.length - 1) ? "bq-listrow--divider" : ""}`, "bq-manage-people-panel-btn")}
        >
            <Avatar name={p.name} size={36} src={p.avatarUrl} />
            <div className="bq-grow">
              <div className="bq-h3">{p.name}</div>
              <div className="bq-meta">
                {ROLE_LABELS[p.role].toUpperCase()}
                {p.tierId ? ` · ${tierName(tiers, p.tierId)}` : ""}
              </div>
            </div>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
        {people.length === 0 && (
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
  const { assignTier, remove, busy, error, setError } = usePersonActions();

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
    await assignTier(shown.id, value || null);
  };

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div className="bq-flex bq-items-center bq-gap-3 bq-mb-4">
          <Avatar name={shown.name} size={44} src={shown.avatarUrl} />
          <div>
            <div className="bq-manage-people-person-sheet-title">{shown.name}</div>
            <div className="bq-meta">{shown.email}</div>
          </div>
        </div>

        <div className="bq-stack">
          <div className="bq-manage-people-person-sheet-box">
            <div className="bq-label">ROLE</div>
            <div className="bq-manage-people-person-sheet-text">{ROLE_LABELS[shown.role]}</div>
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
            <div className="bq-manage-people-person-sheet-meta">
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
          <Button className="bq-mt-4" variant="danger" fullWidth onClick={() => setConfirmRemove(true)}>
            Remove profile
          </Button>
        )}
        <Button className="bq-mt-2" variant="quiet" fullWidth onClick={onClose}>
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
          await remove(shown.id);
          onClose();
        }}
      />
    </>
  );
}

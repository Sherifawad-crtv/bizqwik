import { useFrozen, useMountedThroughExit } from "../../../shared/useLatch";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { useEffect, useState } from "react";
import { useLatch } from "../../../shared/useLatch";
import type { Tier } from "../../../shared/types";
import { ROLE_LABELS } from "../../../shared/types";
import { Button } from "../../../design-system/components/Button";
import { Sheet } from "../../../design-system/components/Sheet";
import { ConfirmSheet } from "../../../design-system/components/ConfirmSheet";
import { TextField } from "../../../design-system/components/FormField";
import { Spinner } from "../../../design-system/components/Spinner";
import { SheetSuccessIcon } from "../../../design-system/components/SheetSuccessIcon";
import { useSheetSuccess } from "../../../design-system/components/useSheetSuccess";
import { MotionList } from "../../../design-system/components/MotionList";
import { IconButton } from "../../../design-system/components/IconButton";
import { invitesToTier, peopleOnTier, tierInUse } from "../domain/team";
import { useInvites, usePeople, useTierActions, useTiers } from "./hooks/useTeam";
import "./TiersPanel.css";

export function TiersPanel({ onOpenPeople, onOpenInvites }: { onOpenPeople: () => void; onOpenInvites: () => void }) {
  const tiers = useTiers();
  // Who is on a tier decides whether it can be deleted, so know it up front.
  const people = usePeople() ?? [];
  const invites = useInvites() ?? [];
  const onTier = (id?: string) => peopleOnTier(people, id);
  const invitedTo = (id?: string) => invitesToTier(invites, id);
  const { remove } = useTierActions();
  const [editing, setEditing] = useState<Tier | "new" | null>(null);
  const [deleting, setDeleting] = useState<Tier | null>(null);
  const shownDeleting = useLatch(deleting);

  if (!tiers) return <Spinner />;

  return (
    <div>
      <div className="bq-flex bq-items-center bq-gap-2 bq-mb-4">
        <span className="bq-h2">Tiers</span>
        <span className="bq-meta">{tiers.length}</span>
        <Button className="bq-manage-tiers-panel-btn" size="md" onClick={() => setEditing("new")}>
          + New tier
        </Button>
      </div>

      <div className="bq-panel">
        <MotionList>
{tiers.map((t, i) => (
          <div key={t.id} className={`bq-listrow ${!(i === tiers.length - 1) ? "bq-listrow--divider" : ""}`}>
            <div className="bq-grow">
              <div className="bq-h3">{t.name}</div>
              <div className="bq-meta">{t.rate} EGP / session · {t.privateCutPct}% private cut</div>
            </div>
            <IconButton icon="pencil" label="Edit tier" onClick={() => setEditing(t)} />
            <IconButton icon="trash" label="Delete tier" tone="danger" onClick={() => setDeleting(t)} />
          </div>
        ))}
</MotionList>
        {tiers.length === 0 && (
          <EmptyState bare icon="tag" title="No pay tiers yet" body="A tier sets what a coach earns per group session and their cut of PT sales. Create one, then assign it to coaches in People." action={{ label: "+ New tier", onClick: () => setEditing("new") }} />
        )}
      </div>

      <TierSheet open={editing !== null} tier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      {shownDeleting && tierInUse(people, invites, shownDeleting.id) ? (
        <Sheet open={!!deleting} onClose={() => setDeleting(null)}>
          <div className="bq-label">DELETE TIER</div>
          <div className="bq-manage-tiers-panel-title">{shownDeleting.name} is still in use</div>
          <div className="bq-manage-tiers-panel-meta">Move these to another tier first, then delete it.</div>
          <div className="bq-manage-tiers-panel-box">
            {onTier(shownDeleting.id).map((p) => (
              <div className="bq-manage-tiers-panel-row" key={p.id}>
                <span className="bq-manage-tiers-panel-title-2">{p.name}</span>
                <span className="bq-manage-tiers-panel-meta-2">{ROLE_LABELS[p.role]}</span>
              </div>
            ))}
            {invitedTo(shownDeleting.id).map((i) => (
              <div className="bq-manage-tiers-panel-row" key={i.email}>
                <span className="bq-manage-tiers-panel-title-3">{i.email}</span>
                <span className="bq-manage-tiers-panel-meta-2">Pending invite</span>
              </div>
            ))}
          </div>
          <Button
            fullWidth
            size="lg"
            onClick={() => {
              const hasPeople = onTier(shownDeleting.id).length > 0;
              setDeleting(null);
              if (hasPeople) onOpenPeople();
              else onOpenInvites();
            }}
          >
            {onTier(shownDeleting.id).length > 0 ? "Change their tier in People" : "Go to pending invites"}
          </Button>
          <Button className="bq-mt-2" variant="quiet" fullWidth onClick={() => setDeleting(null)}>
            Cancel
          </Button>
        </Sheet>
      ) : shownDeleting ? (
        <ConfirmSheet
          open={!!deleting}
          onClose={() => setDeleting(null)}
          kicker="DELETE TIER"
          title={`Delete ${shownDeleting.name}?`}
          sub="Coaches on this tier will need a new one assigned."
          confirmLabel="Delete tier"
          danger
          onConfirm={async () => {
            await remove(shownDeleting.id);
          }}
        />
      ) : null}
    </div>
  );
}

export function TierSheet({ open, tier: tierProp, onClose }: { open: boolean; tier: Tier | null; onClose: () => void }) {
  const mounted = useMountedThroughExit(open);
  const tier = useFrozen(open, tierProp);
  const [name, setName] = useState(tier?.name ?? "");
  const [rate, setRate] = useState(String(tier?.rate ?? ""));
  const [privateCutPct, setPrivateCutPct] = useState(String(tier?.privateCutPct ?? ""));
  const { save: saveTier, busy, error, setError } = useTierActions();
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose, { quiet: true });

  useEffect(() => {
    if (open) {
      setName(tier?.name ?? "");
      setRate(String(tier?.rate ?? ""));
      setPrivateCutPct(String(tier?.privateCutPct ?? ""));
      setError(null);
    }
    // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tier]);

  if (!mounted) return null;

  const save = async () => {
    if (await saveTier(tier, name, rate, privateCutPct)) showSuccess();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={tier ? "Tier updated" : "Tier created"} iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">{tier ? "EDIT TIER" : "NEW TIER"}</div>
          <div className="bq-title">{tier ? tier.name : "New tier"}</div>
          <div className="bq-stack bq-rise">
            <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tier 2 · Intermediate" />
            <TextField label="RATE · EGP / SESSION" type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} />
            <TextField label="PRIVATE TRAINING CUT · %" type="number" min={0} max={100} value={privateCutPct} onChange={(e) => setPrivateCutPct(e.target.value)} placeholder="50" />
          </div>
          {error && (
            <div  className="bq-error bq-error--spaced">
              {error}
            </div>
          )}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>
            {busy ? "Saving…" : tier ? "Save changes" : "Create tier"}
          </Button>
          <Button className="bq-mt-2" variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

// ---------- Bundles (private training) ----------

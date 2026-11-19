import { EmptyState } from "../../design-system/components/EmptyState";
import { useState } from "react";
import { useAsync } from "../../shared/api/useAsync";
import { useLatch } from "../../shared/useLatch";
import { api } from "../../shared/api/backend";
import type { Invite } from "../../shared/types";
import { ROLE_LABELS } from "../../shared/types";
import { Button } from "../../design-system/components/Button";
import { ConfirmSheet } from "../../design-system/components/ConfirmSheet";
import { Spinner } from "../../design-system/components/Spinner";
import { MotionList } from "../../design-system/components/MotionList";
import { IconButton } from "../../design-system/components/IconButton";
import { InviteSheet } from "../../shared/components/InviteFlow";
import "./Invites.css";


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
      <div className="bq-flex bq-items-center bq-gap-2 bq-mb-4">
        <span className="bq-h2">Pending invites</span>
        <span className="bq-meta">{data.invites.length}</span>
        <Button className="bq-manage-invites-panel-btn" size="md" onClick={() => setOpen(true)}>
          + Invite
        </Button>
      </div>

      <div className="bq-panel">
        <MotionList>
{data.invites.map((inv, i) => (
          <div key={inv.email} className={`bq-listrow ${!(i === data.invites.length - 1) ? "bq-listrow--divider" : ""}`}>
            <div className="bq-grow">
              <div className="bq-manage-invites-panel-title">{inv.email}</div>
              <div className="bq-meta">
                {ROLE_LABELS[inv.role].toUpperCase()}
                {inv.tierId ? ` · ${tiers.find((t) => t.id === inv.tierId)?.name ?? ""}` : ""}
              </div>
            </div>
            <IconButton icon="trash" label="Cancel invite" tone="danger" onClick={() => setDeleting(inv)} />
          </div>
        ))}
</MotionList>
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

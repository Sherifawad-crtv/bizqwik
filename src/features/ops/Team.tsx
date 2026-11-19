import { EmptyState } from "../../design-system/components/EmptyState";
import { useState } from "react";
import { api } from "../../shared/api/backend";
import { useAsync } from "../../shared/api/useAsync";
import { BIZQWIK_ROLE_LABELS, type BizqwikRole } from "../../shared/types";
import { Spinner } from "../../design-system/components/Spinner";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Avatar } from "../../design-system/components/Avatar";
import { Sheet } from "../../design-system/components/Sheet";
import { TextField, SelectField } from "../../design-system/components/FormField";
import { ErrorBanner } from "../../design-system/components/ErrorBanner";
import { Card } from "../../design-system/components/Card";
import { SectionHeader } from "../../design-system/components/SectionHeader";
import "./Team.css";

const INVITE_ROLES: { value: BizqwikRole; label: string }[] = [
  { value: "ops_manager", label: BIZQWIK_ROLE_LABELS.ops_manager },
  { value: "teammate", label: BIZQWIK_ROLE_LABELS.teammate },
];

function InviteSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BizqwikRole>("teammate");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setName("");
    setEmail("");
    setRole("teammate");
    setError(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (!email.trim()) return setError("A valid email is required.");
    setBusy(true);
    try {
      await api.ops.inviteTeam(name.trim(), email.trim(), role);
      close();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close}>
      <div className="bq-label">INVITE TEAMMATE</div>
      <div className="bq-title">Add to Bizqwik team</div>
      <div className="bq-stack">
        <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        <TextField label="EMAIL" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@bizqwik.com" />
        <SelectField label="ROLE" value={role} options={INVITE_ROLES} onChange={(v) => setRole(v as BizqwikRole)} />
        <div className="bq-ops-team-invite-sheet-meta">
          They'll sign up with this email to join the ops team.
        </div>
        {error && <ErrorBanner text={error} />}
        <Button className="bq-mt-1" fullWidth size="lg" disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send invite"}
        </Button>
      </div>
    </Sheet>
  );
}

export function Team() {
  const team = useAsync(() => api.ops.team(), []);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (team.loading) return <Spinner />;

  const members = team.data?.members ?? [];
  const invites = team.data?.invites ?? [];

  const cancel = async (email: string) => {
    setError(null);
    try {
      await api.ops.cancelTeamInvite(email);
      team.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel invite.");
    }
  };

  return (
    <div>
      <div className="bq-flex bq-items-center bq-gap-3 bq-mb-5">
        <div className="bq-stat-lg">Team</div>
        <Button className="bq-ml-auto" onClick={() => setSheetOpen(true)}>
          <Icon name="user-plus" size={18} /> Invite
        </Button>
      </div>

      {error && <ErrorBanner text={error} />}

      <SectionHeader count={members.length}>Members</SectionHeader>
      <Card className="bq-overflow-hidden" pad="none">
        {members.map((m, i) => (
          <div key={m.id} className={`bq-listrow bq-listrow--compact ${!(i === members.length - 1) ? "bq-listrow--divider" : ""}`}>
            <Avatar name={m.name} size={34} />
            <div className="bq-grow">
              <div className="bq-ops-team-title">{m.name}</div>
              <div className="bq-ops-team-meta">{m.email}</div>
            </div>
            <span className="bq-ops-team-label">{BIZQWIK_ROLE_LABELS[m.role].toUpperCase()}</span>
          </div>
        ))}
        {members.length === 0 && (
          <EmptyState bare icon="coaches" title="No team members yet" body="Invite ops managers and teammates by email. They get access to this dashboard once they sign up." action={{ label: "Invite someone", onClick: () => setSheetOpen(true) }} />
        )}
      </Card>

      {invites.length > 0 && (
        <div className="bq-mt-26px">
          <SectionHeader count={invites.length}>Pending invites</SectionHeader>
          <Card className="bq-overflow-hidden" pad="none">
            {invites.map((inv, i) => (
              <div key={inv.email} className={`bq-listrow bq-listrow--compact ${!(i === invites.length - 1) ? "bq-listrow--divider" : ""}`}>
                <span className="bq-fg-tertiary bq-flex"><Icon name="envelope" size={18} /></span>
                <div className="bq-grow">
                  <div className="bq-ops-team-text">{inv.email}</div>
                  <div className="bq-ops-team-meta-2">{BIZQWIK_ROLE_LABELS[inv.role]}</div>
                </div>
                <button className="bq-ops-team-btn"
                  onClick={() => cancel(inv.email)}
                  aria-label={`Cancel invite for ${inv.email}`}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            ))}
          </Card>
        </div>
      )}

      <InviteSheet open={sheetOpen} onClose={() => setSheetOpen(false)} onDone={() => team.refetch()} />
    </div>
  );
}

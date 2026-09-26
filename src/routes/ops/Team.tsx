import { EmptyState } from "../../components/EmptyState";
import { useState } from "react";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { BIZQWIK_ROLE_LABELS, type BizqwikRole } from "../../lib/types";
import { Spinner } from "../../components/Spinner";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { Sheet } from "../../components/Sheet";
import { TextField, SelectField } from "../../components/FormField";
import { Card, SectionTitle, ErrorBanner } from "./shared";

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
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>INVITE TEAMMATE</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Add to Bizqwik team</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
        <TextField label="EMAIL" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@bizqwik.com" />
        <SelectField label="ROLE" value={role} options={INVITE_ROLES} onChange={(v) => setRole(v as BizqwikRole)} />
        <div style={{ font: "500 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", padding: "0 2px" }}>
          They'll sign up with this email to join the ops team.
        </div>
        {error && <ErrorBanner text={error} />}
        <Button fullWidth size="lg" disabled={busy} onClick={submit} style={{ marginTop: 4 }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>Team</div>
        <Button onClick={() => setSheetOpen(true)} style={{ marginLeft: "auto" }}>
          <Icon name="user-plus" size={18} /> Invite
        </Button>
      </div>

      {error && <ErrorBanner text={error} />}

      <SectionTitle count={members.length}>Members</SectionTitle>
      <Card style={{ overflow: "hidden" }}>
        {members.map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i === members.length - 1 ? "none" : "1px solid var(--line)" }}>
            <Avatar name={m.name} size={34} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
            </div>
            <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-muted)", flex: "none" }}>{BIZQWIK_ROLE_LABELS[m.role].toUpperCase()}</span>
          </div>
        ))}
        {members.length === 0 && (
          <EmptyState bare icon="coaches" title="No team members yet" body="Invite ops managers and teammates by email. They get access to this dashboard once they sign up." action={{ label: "Invite someone", onClick: () => setSheetOpen(true) }} />
        )}
      </Card>

      {invites.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <SectionTitle count={invites.length}>Pending invites</SectionTitle>
          <Card style={{ overflow: "hidden" }}>
            {invites.map((inv, i) => (
              <div key={inv.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i === invites.length - 1 ? "none" : "1px solid var(--line)" }}>
                <span style={{ color: "var(--ink-faint)", display: "flex" }}><Icon name="envelope" size={18} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: "600 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
                  <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>{BIZQWIK_ROLE_LABELS[inv.role]}</div>
                </div>
                <button
                  onClick={() => cancel(inv.email)}
                  aria-label={`Cancel invite for ${inv.email}`}
                  style={{ border: 0, background: "none", color: "var(--ink-faint)", cursor: "pointer", display: "flex", flex: "none", padding: 4 }}
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

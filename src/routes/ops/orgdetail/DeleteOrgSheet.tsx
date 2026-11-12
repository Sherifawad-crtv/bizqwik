import { useState } from "react";
import { api } from "../../../lib/backend";
import { TextField } from "../../../components/FormField";
import { Button } from "../../../components/Button";
import { Sheet } from "../../../components/Sheet";
import { ErrorBanner } from "../shared";

// Type-the-slug confirmation, GitHub style: the delete button only unlocks
// once the org's slug is typed exactly.
export function DeleteOrgSheet({
  open,
  org,
  usage,
  onClose,
  onDeleted,
}: {
  open: boolean;
  org: { id: string; name: string; slug: string };
  usage: { staffCount: number; clientCount: number };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === org.slug;

  const close = () => {
    if (busy) return;
    setTyped("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.ops.deleteOrg(org.id, typed.trim());
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this organization.");
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--danger-fg)" }}>DELETE ORGANIZATION</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 10px" }}>Delete {org.name}?</div>
      <div style={{ font: "500 14px/1.5 var(--font-body)", color: "var(--ink-muted)", marginBottom: 14 }}>
        This permanently deletes {org.name}, its {usage.staffCount} staff and {usage.clientCount} members (and their app logins), every sale, session, wallet, points balance and its branding. It can't be undone.
      </div>
      <TextField
        label={`TYPE ${org.slug.toUpperCase()} TO CONFIRM`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={org.slug}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {error && <div style={{ marginTop: 10 }}><ErrorBanner text={error} /></div>}
      <Button variant="danger" fullWidth size="lg" style={{ marginTop: 16 }} disabled={!matches || busy} onClick={confirm}>
        {busy ? "Deleting…" : "Delete permanently"}
      </Button>
      <Button variant="secondary" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={close}>
        Cancel
      </Button>
    </Sheet>
  );
}

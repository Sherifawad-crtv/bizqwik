import { useState } from "react";
import { api } from "../../../shared/api/backend";
import { TextField } from "../../../design-system/components/FormField";
import { Button } from "../../../design-system/components/Button";
import { Sheet } from "../../../design-system/components/Sheet";
import { ErrorBanner } from "../../../design-system/components/ErrorBanner";
import "./DeleteOrgSheet.css";

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
      <div className="bq-ops-delete-org-sheet-label">DELETE ORGANIZATION</div>
      <div className="bq-ops-delete-org-sheet-title">Delete {org.name}?</div>
      <div className="bq-ops-delete-org-sheet-text">
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
      {error && <div className="bq-mt-2"><ErrorBanner text={error} /></div>}
      <Button className="bq-mt-4" variant="danger" fullWidth size="lg" disabled={!matches || busy} onClick={confirm}>
        {busy ? "Deleting…" : "Delete permanently"}
      </Button>
      <Button className="bq-mt-2" variant="secondary" fullWidth disabled={busy} onClick={close}>
        Cancel
      </Button>
    </Sheet>
  );
}

import { useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  kicker: string;
  title: string;
  sub?: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}

export function ConfirmSheet({ open, onClose, kicker, title, sub, confirmLabel, danger, onConfirm }: ConfirmSheetProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{kicker}</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 4px" }}>{title}</div>
      {sub && <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginBottom: 16 }}>{sub}</div>}
      {error && (
        <div style={{ marginBottom: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
          {error}
        </div>
      )}
      <Button variant={danger ? "danger" : "primary"} fullWidth size="lg" disabled={busy} onClick={go}>
        {busy ? "Working…" : confirmLabel}
      </Button>
      <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
        Cancel
      </Button>
    </Sheet>
  );
}

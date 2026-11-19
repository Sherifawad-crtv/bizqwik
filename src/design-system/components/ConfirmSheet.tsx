import { useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { SheetSuccessIcon } from "./SheetSuccessIcon";
import { useSheetSuccess } from "./useSheetSuccess";

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
  const { confirmed, iconIn, showSuccess, cancelPending } = useSheetSuccess(open, onClose);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    cancelPending();
    onClose();
  };

  return (
    <Sheet open={open} onClose={handleClose}>
      {confirmed ? (
        <SheetSuccessIcon label={confirmLabel} iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">{kicker}</div>
          <div className="bq-confirm-sheet-title">{title}</div>
          {sub && <div className="bq-confirm-sheet-meta">{sub}</div>}
          {error && (
            <div className="bq-rise bq-confirm-sheet-text">
              {error}
            </div>
          )}
          <Button variant={danger ? "danger" : "primary"} fullWidth size="lg" disabled={busy} onClick={go}>
            {busy ? "Working…" : confirmLabel}
          </Button>
          <Button className="bq-mt-2" variant="quiet" fullWidth onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

import { useCallback, useState, type ReactNode } from "react";
import { AddSessionSheet } from "./AddSessionSheet";
import { Sheet } from "../../design-system/components/Sheet";
import { Button } from "../../design-system/components/Button";
import { useAuth } from "../auth";
import { useAsync } from "../api/useAsync";
import { api } from "../api/backend";
import { QrScanner } from "../../design-system/components/QrScanner";
import { SheetSuccessIcon } from "../../design-system/components/SheetSuccessIcon";
import { useSheetSuccess } from "../../design-system/components/useSheetSuccess";
import type { PtScanPreview } from "../types";
import "./ScanFlow.css";

// The coach's FAB is a scanner. What was scanned decides what happens next:
// the coaches'-room QR -> the session stepper (locked to today); a member's
// PT code -> confirm deducting one session from that bundle.
export function ScanFlow({ trigger, hint }: { trigger: (open: () => void, busy: boolean) => ReactNode; hint?: string }) {
  const { profile } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<{ token: string; date: string; month: string } | null>(null);
  const [pt, setPt] = useState<{ token: string; preview: PtScanPreview } | null>(null);

  const { data } = useAsync(() => (attendance ? api.month(attendance.month) : Promise.resolve(null)), [attendance?.month, profile?.id]);
  const rate = data?.rows.find((r) => r.coachId === profile?.id)?.rate ?? 0;

  const onScan = useCallback(async (token: string) => {
    setScanning(false);
    setChecking(true);
    try {
      const res = await api.scan(token);
      // Let the scanner's exit finish before the next sheet slides up.
      window.setTimeout(() => {
        if (res.kind === "attendance") setAttendance({ token, date: res.date, month: res.month });
        else setPt({ token, preview: res.package });
      }, 60);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't read that code.");
    } finally {
      setChecking(false);
    }
  }, []);

  if (!profile) return null;

  return (
    <>
      {trigger(() => setScanning(true), checking)}
      {scanning && (
        <QrScanner
          title="Scan"
          hint={hint ?? "The coaches' room QR to log attendance, or a member's PT code to log their session."}
          onClose={() => setScanning(false)}
          onScan={onScan}
        />
      )}
      <Sheet open={!!problem} onClose={() => setProblem(null)}>
        <div className="bq-label">SCAN</div>
        <div className="bq-scan-flow-title">That didn't work</div>
        <div className="bq-scan-flow-text" role="alert">
          {problem}
        </div>
        <Button className="bq-mt-4" fullWidth size="lg" onClick={() => { setProblem(null); setScanning(true); }}>
          Scan again
        </Button>
        <Button className="bq-mt-2" fullWidth variant="secondary" onClick={() => setProblem(null)}>
          Close
        </Button>
      </Sheet>
      <AddSessionSheet
        open={!!attendance}
        onClose={() => setAttendance(null)}
        coachId={profile.id}
        month={attendance?.month ?? ""}
        rate={rate}
        scan={attendance ?? undefined}
      />
      <PtDeliverSheet scan={pt} onClose={() => setPt(null)} />
    </>
  );
}

function PtDeliverSheet({ scan, onClose }: { scan: { token: string; preview: PtScanPreview } | null; onClose: () => void }) {
  const open = !!scan;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);
  const p = scan?.preview;

  const confirm = async () => {
    if (!scan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.deliverSession(scan.token);
      setLeft(res.package.sessionsRemaining);
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={`Session logged · ${left ?? 0} left`} iconIn={iconIn} />
      ) : p ? (
        <>
          <div className="bq-label">PRIVATE TRAINING</div>
          <div className="bq-stat-lg bq-scan-flow-pt-deliver-sheet-spacing">{p.clientName}</div>
          <div className="bq-scan-flow-pt-deliver-sheet-meta">
            {p.bundleName} · expires {p.expiryDate}
          </div>
          <div className="bq-scan-flow-pt-deliver-sheet-row">
            <span className="bq-label">SESSIONS LEFT</span>
            <span className="tabular bq-scan-flow-pt-deliver-sheet-title">
              {p.sessionsRemaining} → {p.sessionsRemaining - 1}
            </span>
            <span className="bq-meta">of {p.sessionsIncluded}</span>
          </div>
          {error && (
            <div role="alert" className="bq-error bq-error--spaced">
              {error}
            </div>
          )}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={confirm}>
            {busy ? "Logging…" : "Deduct 1 session"}
          </Button>
          <Button className="bq-mt-2" fullWidth variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}

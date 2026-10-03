import { useState } from "react";
import { api, type PaymentRequest } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { egp } from "../../lib/format";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { TextField } from "../../components/FormField";
import { Card } from "./shared";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Members who paid by InstaPay and uploaded the receipt. Nothing is granted
 * until she approves; she checks the screenshot against her InstaPay app. */
export function PaymentRequestsCard() {
  const reqs = useAsync(() => api.paymentRequests(), []);
  const [open, setOpen] = useState(false);
  const list = reqs.data?.requests ?? [];
  if (list.length === 0 && !open) return null;
  return (
    <>
      <button
        data-sq
        data-tap
        onClick={() => setOpen(true)}
        style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", marginBottom: 10, textAlign: "left", cursor: "pointer", background: "var(--logging-bg)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 18px" }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 999, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", color: "var(--logging-fg)" }}>
          <Icon name="cash" size={18} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", font: "700 15px var(--font-body)", color: "var(--logging-fg)" }}>
            {list.length} payment{list.length === 1 ? "" : "s"} to approve
          </span>
          <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--logging-fg)" }}>Check the receipt, then approve</span>
        </span>
        <Icon name="chevron-right" size={16} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>INSTAPAY</div>
        <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 14px" }}>Payments to approve</div>
        {list.length === 0 && <div style={{ font: "400 14px var(--font-body)", color: "var(--ink-muted)", padding: "12px 0 8px" }}>All caught up.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: "60vh", overflowY: "auto" }}>
          {list.map((r) => (
            <RequestRow key={r.id} r={r} onDone={() => reqs.refetch()} />
          ))}
        </div>
      </Sheet>
    </>
  );
}

function RequestRow({ r, onDone }: { r: PaymentRequest; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {r.proofUrl ? (
          <a href={r.proofUrl} target="_blank" rel="noreferrer" aria-label={`Open ${r.clientName}'s receipt`} style={{ flex: "none" }}>
            <img src={r.proofUrl} alt={`${r.clientName}'s receipt`} style={{ width: 72, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)", background: "var(--sunken)" }} />
          </a>
        ) : (
          <span style={{ width: 72, height: 96, flex: "none", borderRadius: 10, background: "var(--sunken)" }} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: "700 16px var(--font-body)" }}>{r.clientName}</div>
          <div style={{ font: "400 14px var(--font-body)", marginTop: 2 }}>{r.name}</div>
          <div style={{ font: "800 20px var(--font-body)", marginTop: 4 }}>{egp(r.price)}</div>
          <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>{when(r.createdAt)}</div>
        </div>
      </div>
      {rejecting ? (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <TextField label="TELL THEM WHY (OPTIONAL)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Amount didn't match" />
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="danger" style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.rejectPayment(r.id, note))}>{busy ? "Sending…" : "Reject"}</Button>
            <Button variant="quiet" disabled={busy} onClick={() => setRejecting(false)}>Back</Button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Button style={{ flex: 1 }} disabled={busy} onClick={() => run(() => api.approvePayment(r.id))}>{busy ? "Approving…" : "Approve"}</Button>
          <Button variant="quiet" disabled={busy} onClick={() => setRejecting(true)}>Reject</Button>
        </div>
      )}
      {error && <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px", marginTop: 10 }}>{error}</div>}
    </Card>
  );
}

import { useState } from "react";
import { usePaymentDecision, usePaymentRequests } from "./hooks/useSchedule";
import type { PaymentRequest } from "../domain/types";
import { egp } from "../../../shared/format";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { Sheet } from "../../../design-system/components/Sheet";
import { TextField } from "../../../design-system/components/FormField";
import { Card } from "../../../design-system/components/Card";
import "./PaymentRequests.css";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Members who paid by InstaPay and uploaded the receipt. Nothing is granted
 * until she approves; she checks the screenshot against her InstaPay app. */
export function PaymentRequestsCard() {
  const reqs = usePaymentRequests();
  const [open, setOpen] = useState(false);
  const list = reqs.data?.requests ?? [];
  if (list.length === 0 && !open) return null;
  return (
    <>
      <button
        className="bq-scale bq-frontdesk-payment-requests-card-btn"
        onClick={() => setOpen(true)}
      >
        <span className="bq-frontdesk-payment-requests-card-row">
          <Icon name="cash" size={18} />
        </span>
        <span className="bq-grow">
          <span className="bq-frontdesk-payment-requests-card-title">
            {list.length} payment{list.length === 1 ? "" : "s"} to approve
          </span>
          <span className="bq-frontdesk-payment-requests-card-meta">Check the receipt, then approve</span>
        </span>
        <Icon name="chevron-right" size={16} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="bq-label">INSTAPAY</div>
        <div className="bq-frontdesk-payment-requests-card-title-2">Payments to approve</div>
        {list.length === 0 && <div className="bq-frontdesk-payment-requests-card-text">All caught up.</div>}
        <div className="bq-frontdesk-payment-requests-card-stack">
          {list.map((r) => (
            <RequestRow key={r.id} r={r} onDone={() => reqs.refetch()} />
          ))}
        </div>
      </Sheet>
    </>
  );
}

function RequestRow({ r, onDone }: { r: PaymentRequest; onDone: () => void }) {
  const { busy, error, approve, reject } = usePaymentDecision(r.id, onDone);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  return (
    <Card className="bq-frontdesk-payment-requests-request-row-card" pad="none">
      <div className="bq-flex bq-gap-3 bq-items-start">
        {r.proofUrl ? (
          <a className="bq-flex-none" href={r.proofUrl} target="_blank" rel="noreferrer" aria-label={`Open ${r.clientName}'s receipt`}>
            <img className="bq-frontdesk-payment-requests-request-row-img" src={r.proofUrl} alt={`${r.clientName}'s receipt`} />
          </a>
        ) : (
          <span className="bq-frontdesk-payment-requests-request-row-box" />
        )}
        <div className="bq-grow">
          <div className="bq-h3">{r.clientName}</div>
          <div className="bq-frontdesk-payment-requests-request-row-text">{r.name}</div>
          <div className="bq-frontdesk-payment-requests-request-row-title">{egp(r.price)}</div>
          <div className="bq-frontdesk-payment-requests-request-row-meta">{when(r.createdAt)}</div>
        </div>
      </div>
      {rejecting ? (
        <div className="bq-mt-3 bq-flex bq-col bq-gap-2">
          <TextField label="TELL THEM WHY (OPTIONAL)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Amount didn't match" />
          <div className="bq-flex bq-gap-2">
            <Button className="bq-flex-1" variant="danger" disabled={busy} onClick={() => reject(note)}>{busy ? "Sending…" : "Reject"}</Button>
            <Button variant="quiet" disabled={busy} onClick={() => setRejecting(false)}>Back</Button>
          </div>
        </div>
      ) : (
        <div className="bq-mt-3 bq-flex bq-gap-2">
          <Button className="bq-flex-1" disabled={busy} onClick={approve}>{busy ? "Approving…" : "Approve"}</Button>
          <Button variant="quiet" disabled={busy} onClick={() => setRejecting(true)}>Reject</Button>
        </div>
      )}
      {error && <div className="bq-rise bq-frontdesk-payment-requests-request-row-text-2">{error}</div>}
    </Card>
  );
}

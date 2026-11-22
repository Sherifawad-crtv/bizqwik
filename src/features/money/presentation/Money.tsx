import { cx } from "../../../design-system/cx";
import { useSetHeader } from "../../../shared/screen/header";
import { useSticky } from "../../../design-system/hooks/useSticky";
import { fmt, formatDateTime } from "../../../shared/format";
import { Segmented } from "../../../design-system/components/Segmented";
import { Spinner } from "../../../design-system/components/Spinner";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { useState } from "react";
import { useLatch } from "../../../shared/useLatch";
import { LocationSwitcher, useCurrentLocation } from "../../../shared/locations";
import { Sheet } from "../../../design-system/components/Sheet";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { Tag } from "../../../design-system/components/Tag";
import { clientOf, paymentCount, txnNote, txnReference, type Txn } from "../domain/money";
import { useClientsWhile, useMoney } from "./hooks/useMoney";
import "./Money.css";

type Range = "1" | "3" | "12";
const RANGES: { value: Range; label: string }[] = [
  { value: "1", label: "THIS MONTH" },
  { value: "3", label: "3 MONTHS" },
  { value: "12", label: "12 MONTHS" },
];

/** The solo owner's money: what came in, how it was paid, and every InstaPay
 * transfer so it can be matched against the bank app. */
export function Money() {
  useSetHeader({ kicker: "BUSINESS", title: "Money" }, []);
  const [range, setRange] = useSticky<Range>("moneyRange", "1", { valid: (v) => v === "1" || v === "3" || v === "12" });
  const n = Number(range);
  const [open, setOpen] = useState<Txn | null>(null);
  // Each location's money, or "All" for the whole business.
  const { locations, current, ready: locsReady } = useCurrentLocation();
  const [allLocations, setAllLocations] = useState(false);
  const here = locations.length > 1 && !allLocations ? (current?.id ?? null) : null;
  const { data, error } = useMoney(n, here, locsReady);

  if (error) return <EmptyState icon="inbox" title="Couldn't load your money" body="Check your connection and try again." />;

  return (
    <div>
      <LocationSwitcher all isAll={allLocations} onAll={setAllLocations} />
      <div className="bq-flex bq-justify-center bq-mb-4">
        <Segmented value={range} onChange={setRange} options={RANGES} />
      </div>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <Card className="bq-money-card" pad="none">
            <div className="bq-label">REVENUE · EGP</div>
            <div className="bq-money-title">{fmt(here ? data.pay.total : data.rev.totals.revenue)}</div>
            <div className="bq-money-meta">
              {here
                ? `${paymentCount(data.pay)} payment${paymentCount(data.pay) === 1 ? "" : "s"} at ${current?.name ?? "this location"}`
                : `${data.rev.activeSubscribers.total} active member${data.rev.activeSubscribers.total === 1 ? "" : "s"}`}
            </div>
            {data.pay.byMethod.length > 0 && (
              <div className="bq-flex bq-wrap bq-gap-2 bq-mt-4">
                {data.pay.byMethod.map((m) => (
                  <span className="bq-money-meta-2" key={m.method} style={{ color: m.method === "instapay" ? "var(--color-bg-fill-primary-active)" : "var(--color-text-secondary-default)", background: m.method === "instapay" ? "var(--color-bg-fill-accent-default)" : "var(--color-bg-surface-secondary-default)" }}>
                    {m.label} · {fmt(m.amount)}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <SectionHeader count={data.txns.length}>Transactions</SectionHeader>
          <Card className="bq-overflow-hidden bq-mb-3" pad="none">
            {data.txns.slice(0, 100).map((t, i, arr) => (
              <button key={t.id} className={cx(`bq-plain bq-scale bq-listrow bq-listrow--compact ${!(i === arr.length - 1) ? "bq-listrow--divider" : ""}`, "bq-money-btn")} onClick={() => setOpen(t)}>
                <div className="bq-grow">
                  <div className="bq-money-title-2">{t.clientName ?? "Client"}</div>
                  <div className="bq-money-meta-3">
                    {t.what} · {formatDateTime(t.at)}
                  </div>
                </div>
                <Tag tone={t.method === "InstaPay" ? "primary" : "neutral"}>{t.method.toUpperCase()}</Tag>
                <div className="bq-money-meta-4" style={{ color: t.refund ? "var(--color-text-status-danger-default)" : "var(--color-text-primary-default)" }}>{t.refund ? "−" : ""}{fmt(t.amount)}</div>
                <Icon name="chevron-right" size={16} />
              </button>
            ))}
            {data.txns.length === 0 && (
              <EmptyState bare icon="inbox" title="No transactions yet" body="Sales and refunds are listed here with how each was paid." />
            )}
          </Card>
        </>
      )}
      <TxnSheet txn={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null;
  return (
    <div className="bq-money-row-row">
      <span className="bq-money-row-label">{k}</span>
      <span className="bq-money-row-text">{v}</span>
    </div>
  );
}

/** Everything about one transaction: the amount, how it was paid, who the
 * client is and their plan today. */
function TxnSheet({ txn, onClose }: { txn: Txn | null; onClose: () => void }) {
  const t = useLatch(txn);
  // The client list is only needed once a transaction is opened.
  const clients = useClientsWhile(txn !== null);
  if (!t) return null;
  const client = clientOf(t, clients);
  const note = txnNote(t);
  return (
    <Sheet open={txn !== null} onClose={onClose}>
      <div className="bq-label">{t.refund ? "REFUND" : "PAYMENT"} · {t.method.toUpperCase()}</div>
      <div className="bq-money-txn-sheet-title" style={{ color: t.refund ? "var(--color-text-status-danger-default)" : "var(--color-text-primary-default)" }}>{t.refund ? "−" : ""}{fmt(t.amount)} <span className="bq-money-txn-sheet-meta">EGP</span></div>
      <div className="bq-money-txn-sheet-meta-2">{t.what}</div>

      <div className="bq-money-txn-sheet-label">TRANSACTION</div>
      <Row k="WHAT" v={t.what} />
      <Row k="PAID VIA" v={t.method} />
      <Row k="DATE & TIME" v={formatDateTime(t.at)} />
      <Row k="RECORDED BY" v={t.entry.actorName} />
      <Row k="NOTE" v={note} />
      <Row k="REFERENCE" v={txnReference(t)} />

      <div className="bq-money-txn-sheet-label-2">CLIENT</div>
      <Row k="NAME" v={t.clientName ?? "Unknown"} />
      <Row k="PHONE" v={client?.phone} />
      <Row k="EMAIL" v={client?.email} />
      <Row k="PLAN NOW" v={client ? (client.groupPlan ? `${client.groupPlan.name} · ends ${new Date(client.groupPlan.expiresAt).toLocaleDateString()}` : "No active plan") : null} />

      <Button className="bq-mt-4" variant="quiet" fullWidth onClick={onClose}>Close</Button>
    </Sheet>
  );
}

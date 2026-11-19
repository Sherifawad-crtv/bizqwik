import { cx } from "../../design-system/cx";
import { api } from "../../shared/api/backend";
import { useAsync } from "../../shared/api/useAsync";
import { useSetHeader } from "../../shared/screen/header";
import { useSticky } from "../../design-system/hooks/useSticky";
import { fmt, formatDateTime } from "../../shared/format";
import { Segmented } from "../../design-system/components/Segmented";
import { Spinner } from "../../design-system/components/Spinner";
import { EmptyState } from "../../design-system/components/EmptyState";
import { useState } from "react";
import { useLatch } from "../../shared/useLatch";
import { LocationSwitcher, useCurrentLocation } from "../../shared/locations";
import type { ActivityEntry, ClientWithPackage } from "../../shared/types";
import { Sheet } from "../../design-system/components/Sheet";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Card } from "../../design-system/components/Card";
import { SectionHeader } from "../../design-system/components/SectionHeader";
import { Tag } from "../../design-system/components/Tag";
import "./Money.css";

interface Txn { id: string; at: string; clientName: string | null; amount: number; what: string; method: string; refund: boolean; entry: ActivityEntry }

const METHOD_LABEL: Record<string, string> = { cash: "Cash", card: "Card", instapay: "InstaPay", wallet: "Wallet" };

/** Every sale and refund in the range, newest first, each tagged with how it was paid. */
function toTransactions(list: ActivityEntry[], months: number): Txn[] {
  const now = new Date();
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1).getTime();
  const out: Txn[] = [];
  for (const a of list) {
    if (Date.parse(a.at) < since) continue;
    const m = (a.meta ?? {}) as Record<string, unknown>;
    const amount = Number(a.amount ?? 0);
    if (a.type.startsWith("sale_") || a.type === "class_collected") {
      const name = (m.name ?? m.title) as string | undefined;
      out.push({ id: a.id, at: a.at, clientName: a.clientName ?? (a.type === "sale_dropin" ? "Drop-in guest" : null), amount, what: name ?? (a.type === "sale_package" ? "PT package" : a.type === "class_collected" ? "Class" : a.type === "sale_dropin" ? "Drop-in" : "Sale"), method: METHOD_LABEL[String(m.payMethod ?? "")] ?? "Not recorded", refund: false, entry: a });
    } else if (a.type === "refund_desk") {
      const note = String(m.note ?? "");
      out.push({ id: a.id, at: a.at, clientName: a.clientName, amount, what: "Refund", method: /^instapay/i.test(note) ? "InstaPay" : "Cash", refund: true, entry: a });
    } else if (a.type === "wallet_refund") {
      out.push({ id: a.id, at: a.at, clientName: a.clientName, amount, what: "Refund", method: "Wallet", refund: true, entry: a });
    }
  }
  return out;
}

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
  const { data, error } = useAsync(async () => {
    if (!locsReady) return null;
    const [rev, pay, act] = await Promise.all([api.revenue(n), api.paymentsSummary(n, here), api.activity(300)]);
    const txns = toTransactions(act.activity ?? [], n).filter((t) => !here || (t.entry.meta as Record<string, unknown> | null)?.locationId === here);
    return { rev, pay, txns };
  }, [range, here, locsReady]);

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
                ? `${data.pay.byMethod.reduce((a, m) => a + m.count, 0)} payment${data.pay.byMethod.reduce((a, m) => a + m.count, 0) === 1 ? "" : "s"} at ${current?.name ?? "this location"}`
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
  const list = useAsync(() => (txn ? api.clients() : Promise.resolve({ clients: [] as ClientWithPackage[] })), [txn !== null]);
  const clients = list.data?.clients ?? [];
  if (!t) return null;
  const m = (t.entry.meta ?? {}) as Record<string, unknown>;
  const matches = clients.filter((c) => c.name === t.clientName);
  const client = matches.length === 1 ? matches[0] : null;
  const note = String(m.note ?? "").replace(/^InstaPay\s*·?\s*/i, "");
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
      <Row k="REFERENCE" v={t.id.slice(0, 8).toUpperCase()} />

      <div className="bq-money-txn-sheet-label-2">CLIENT</div>
      <Row k="NAME" v={t.clientName ?? "Unknown"} />
      <Row k="PHONE" v={client?.phone} />
      <Row k="EMAIL" v={client?.email} />
      <Row k="PLAN NOW" v={client ? (client.groupPlan ? `${client.groupPlan.name} · ends ${new Date(client.groupPlan.expiresAt).toLocaleDateString()}` : "No active plan") : null} />

      <Button className="bq-mt-4" variant="quiet" fullWidth onClick={onClose}>Close</Button>
    </Sheet>
  );
}

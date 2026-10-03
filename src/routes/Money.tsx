import { api } from "../lib/backend";
import { useAsync } from "../lib/useAsync";
import { useSetHeader } from "../lib/header";
import { useSticky } from "../lib/useSticky";
import { fmt, formatDateTime } from "../lib/format";
import { Segmented } from "../components/Segmented";
import { Spinner } from "../components/Spinner";
import { EmptyState } from "../components/EmptyState";
import { useState } from "react";
import { useLatch } from "../lib/useLatch";
import { LocationSwitcher, useCurrentLocation } from "../lib/locations";
import type { ActivityEntry, ClientWithPackage } from "../lib/types";
import { Sheet } from "../components/Sheet";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Card, SectionTitle } from "./frontdesk/shared";

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
  const { locations, current } = useCurrentLocation();
  const [allLocations, setAllLocations] = useState(false);
  const here = locations.length > 1 && !allLocations ? (current?.id ?? null) : null;
  const { data, error } = useAsync(async () => {
    const [rev, pay, act] = await Promise.all([api.revenue(n), api.paymentsSummary(n, here), api.activity(300)]);
    const txns = toTransactions(act.activity ?? [], n).filter((t) => !here || (t.entry.meta as Record<string, unknown> | null)?.locationId === here);
    return { rev, pay, txns };
  }, [range, here]);

  if (error) return <EmptyState icon="inbox" title="Couldn't load your money" body="Check your connection and try again." />;

  return (
    <div>
      <LocationSwitcher all isAll={allLocations} onAll={setAllLocations} />
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Segmented value={range} onChange={setRange} options={RANGES} />
      </div>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <Card style={{ padding: "22px 22px 20px" }}>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>REVENUE · EGP</div>
            <div style={{ font: "800 52px/1.05 var(--font-body)", letterSpacing: "-.03em", marginTop: 6 }}>{fmt(here ? data.pay.total : data.rev.totals.revenue)}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 6 }}>
              {here
                ? `${data.pay.byMethod.reduce((a, m) => a + m.count, 0)} payment${data.pay.byMethod.reduce((a, m) => a + m.count, 0) === 1 ? "" : "s"} at ${current?.name ?? "this location"}`
                : `${data.rev.activeSubscribers.total} active member${data.rev.activeSubscribers.total === 1 ? "" : "s"}`}
            </div>
            {data.pay.byMethod.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                {data.pay.byMethod.map((m) => (
                  <span key={m.method} style={{ font: "700 12px var(--font-mono)", borderRadius: 999, padding: "6px 12px", color: m.method === "instapay" ? "var(--primary-pressed)" : "var(--ink-muted)", background: m.method === "instapay" ? "var(--primary-tint)" : "var(--sunken)" }}>
                    {m.label} · {fmt(m.amount)}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <SectionTitle count={data.txns.length}>Transactions</SectionTitle>
          <Card style={{ overflow: "hidden", marginBottom: 12 }}>
            {data.txns.slice(0, 100).map((t, i, arr) => (
              <button key={t.id} data-tap onClick={() => setOpen(t)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left", padding: "13px 18px", borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.clientName ?? "Client"}</div>
                  <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>
                    {t.what} · {formatDateTime(t.at)}
                  </div>
                </div>
                <span style={{ flex: "none", font: "700 10px var(--font-mono)", letterSpacing: ".06em", borderRadius: 8, padding: "3px 7px", color: t.method === "InstaPay" ? "var(--primary-pressed)" : "var(--ink-muted)", background: t.method === "InstaPay" ? "var(--primary-tint)" : "var(--sunken)" }}>{t.method.toUpperCase()}</span>
                <div style={{ flex: "none", minWidth: 64, textAlign: "right", font: "800 15px var(--font-mono)", color: t.refund ? "var(--danger-fg)" : "var(--ink)" }}>{t.refund ? "−" : ""}{fmt(t.amount)}</div>
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
    <div style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ width: 110, flex: "none", font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", paddingTop: 2 }}>{k}</span>
      <span style={{ flex: 1, minWidth: 0, font: "600 15px/1.4 var(--font-body)", wordBreak: "break-word" }}>{v}</span>
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
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{t.refund ? "REFUND" : "PAYMENT"} · {t.method.toUpperCase()}</div>
      <div style={{ font: "800 40px/1.1 var(--font-body)", letterSpacing: "-.02em", margin: "6px 0 2px", color: t.refund ? "var(--danger-fg)" : "var(--ink)" }}>{t.refund ? "−" : ""}{fmt(t.amount)} <span style={{ font: "700 16px var(--font-mono)", color: "var(--ink-faint)" }}>EGP</span></div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginBottom: 12 }}>{t.what}</div>

      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "12px 0 0" }}>TRANSACTION</div>
      <Row k="WHAT" v={t.what} />
      <Row k="PAID VIA" v={t.method} />
      <Row k="DATE & TIME" v={formatDateTime(t.at)} />
      <Row k="RECORDED BY" v={t.entry.actorName} />
      <Row k="NOTE" v={note} />
      <Row k="REFERENCE" v={t.id.slice(0, 8).toUpperCase()} />

      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "18px 0 0" }}>CLIENT</div>
      <Row k="NAME" v={t.clientName ?? "Unknown"} />
      <Row k="PHONE" v={client?.phone} />
      <Row k="EMAIL" v={client?.email} />
      <Row k="PLAN NOW" v={client ? (client.groupPlan ? `${client.groupPlan.name} · ends ${new Date(client.groupPlan.expiresAt).toLocaleDateString()}` : "No active plan") : null} />

      <Button variant="quiet" fullWidth style={{ marginTop: 16 }} onClick={onClose}>Close</Button>
    </Sheet>
  );
}

import { api } from "../lib/backend";
import { useAsync } from "../lib/useAsync";
import { useSetHeader } from "../lib/header";
import { useSticky } from "../lib/useSticky";
import { fmt, formatDateTime } from "../lib/format";
import { Segmented } from "../components/Segmented";
import { Spinner } from "../components/Spinner";
import { EmptyState } from "../components/EmptyState";
import { Card, SectionTitle } from "./frontdesk/shared";

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
  const { data, error } = useAsync(async () => {
    const [rev, pay] = await Promise.all([api.revenue(n), api.paymentsSummary(n)]);
    return { rev, pay };
  }, [range]);

  if (error) return <EmptyState icon="inbox" title="Couldn't load your money" body="Check your connection and try again." />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Segmented value={range} onChange={setRange} options={RANGES} />
      </div>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <Card style={{ padding: "22px 22px 20px" }}>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>REVENUE · EGP</div>
            <div style={{ font: "800 52px/1.05 var(--font-body)", letterSpacing: "-.03em", marginTop: 6 }}>{fmt(data.rev.totals.revenue)}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 6 }}>
              {data.rev.activeSubscribers.total} active member{data.rev.activeSubscribers.total === 1 ? "" : "s"}
            </div>
          </Card>

          <SectionTitle>How you were paid</SectionTitle>
          <Card style={{ padding: "6px 18px" }}>
            {data.pay.byMethod.map((m, i) => {
              const share = data.pay.total > 0 ? Math.round((m.amount / data.pay.total) * 100) : 0;
              return (
                <div key={m.method} style={{ padding: "14px 0", borderBottom: i === data.pay.byMethod.length - 1 ? "none" : "1px solid var(--line)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ font: "700 15px var(--font-body)", flex: 1 }}>{m.label}</span>
                    <span style={{ font: "800 16px var(--font-mono)" }}>{fmt(m.amount)}</span>
                    <span style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", width: 40, textAlign: "right" }}>{share}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: "var(--sunken)", marginTop: 8, overflow: "hidden" }}>
                    <div style={{ width: `${share}%`, height: "100%", borderRadius: 999, background: m.method === "instapay" ? "var(--primary)" : "var(--ink-faint)" }} />
                  </div>
                  <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 6 }}>
                    {m.count} payment{m.count === 1 ? "" : "s"}
                  </div>
                </div>
              );
            })}
            {data.pay.byMethod.length === 0 && (
              <EmptyState bare icon="wallet" title="No payments yet" body="Sell a plan or take a drop-in and it shows up here, split by InstaPay, cash and card." />
            )}
          </Card>

          <SectionTitle count={data.pay.transfers.length}>InstaPay transfers</SectionTitle>
          <Card style={{ overflow: "hidden", marginBottom: 12 }}>
            {data.pay.transfers.slice(0, 30).map((t, i, arr) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line)" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.clientName ?? "Client"}</div>
                  <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>
                    {t.what} · {formatDateTime(t.at)}
                  </div>
                </div>
                <div style={{ font: "800 15px var(--font-mono)" }}>{fmt(t.amount)}</div>
              </div>
            ))}
            {data.pay.transfers.length === 0 && (
              <EmptyState bare icon="inbox" title="No InstaPay transfers" body="When you record a sale as InstaPay it's listed here, so you can tick it off against your bank app." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

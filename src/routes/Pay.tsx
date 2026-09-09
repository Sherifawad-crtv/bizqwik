import { useState } from "react";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { useLatch } from "../lib/useLatch";
import { api, MOCK } from "../lib/backend";
import { fmt } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { MonthPicker } from "../components/MonthPicker";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { Spinner } from "../components/Spinner";
import { canLog, type Rollup } from "../lib/types";

export function Pay() {
  const [month, setMonth] = useState(MOCK.CURRENT_MONTH);
  const [paying, setPaying] = useState<Rollup | null>(null);
  const shownPaying = useLatch(paying);

  const { data, refetch } = useAsync(() => api.month(month), [month]);

  useSetHeader({ kicker: "SETTLED · READY", title: "To Pay", right: <MonthPicker month={month} onChange={setMonth} /> }, [month]);

  if (!data) return <Spinner />;
  const rows = data.rows.filter((r) => canLog(r.role) && r.state === "settled");

  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
    title: r.name,
    meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? ""}`,
    sub: r.rate + " EGP/SESSION",
    state: r.state,
    amount: r.total,
    onClick: () => setPaying(r),
  }));

  return (
    <div>
      <MoneyHero
        label="DUE NOW · EGP"
        value={fmt(rows.reduce((s, r) => s + r.total, 0))}
        stats={[
          { k: "PAYEES", v: String(rows.length) },
          { k: "SESSIONS", v: String(rows.reduce((s, r) => s + r.count, 0)) },
          { k: "MONTH", v: month },
        ]}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Payout queue</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{rows.length} due</span>
      </div>
      <RollupTable colA="PAYEE" colB="METHOD" rows={rowItems} />
      <div style={{ padding: "18px 4px 0", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
        Paying moves a coach to PAID — irreversible without a head reopen.
      </div>

      {shownPaying && (
        <ConfirmSheet
          open={!!paying}
          onClose={() => setPaying(null)}
          kicker="MARK PAID"
          title={`Pay ${shownPaying.name}?`}
          sub={`${fmt(shownPaying.total)} EGP · ${shownPaying.count} sessions · ${month}. This records the payout as made in cash — it can't be undone from here.`}
          confirmLabel={`Mark paid · ${fmt(shownPaying.total)} EGP`}
          onConfirm={async () => {
            await api.pay(shownPaying.coachId, month);
            refetch();
          }}
        />
      )}
    </div>
  );
}

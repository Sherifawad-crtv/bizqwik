import { useState } from "react";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { fmt, formatDateTime } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { MonthPicker } from "../components/MonthPicker";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { Spinner } from "../components/Spinner";
import { canLog } from "../lib/types";

export function PayHistory() {
  const [month, setMonth] = useState(MOCK.CURRENT_MONTH);
  const { data } = useAsync(() => api.month(month), [month]);

  useSetHeader({ kicker: "LEDGER", title: "History", right: <MonthPicker month={month} onChange={setMonth} /> }, [month]);

  if (!data) return <Spinner />;
  const rows = data.rows.filter((r) => canLog(r.role) && r.state === "paid");

  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
    title: r.name,
    meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? ""}`,
    sub: r.paidAt ? `PAID ${formatDateTime(r.paidAt)}` : undefined,
    state: r.state,
    amount: r.total,
  }));

  return (
    <div>
      <MoneyHero
        label="PAID · EGP"
        value={fmt(rows.reduce((s, r) => s + r.total, 0))}
        stats={[
          { k: "PAYEES", v: String(rows.length) },
          { k: "SESSIONS", v: String(rows.reduce((s, r) => s + r.count, 0)) },
          { k: "MONTH", v: month },
        ]}
      />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Paid runs</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{rows.length} paid</span>
      </div>
      <RollupTable colA="PAYEE" colB="METHOD" rows={rowItems} />
    </div>
  );
}

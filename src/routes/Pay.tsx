import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { MOCK } from "../lib/backend";
import { fmt, monthLabel } from "../lib/format";
import { loadYearRollups, sumTotal } from "../lib/payables";
import { HomeAvatar } from "../components/HomeAvatar";
import { MoneyHero } from "../components/MoneyHero";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { Spinner } from "../components/Spinner";
import { StatePill } from "../components/StatePill";
import type { Rollup } from "../lib/types";

/** Where this month stands: paid out, ready to pay, and still being logged. */
function MonthStatus({ rows }: { rows: Rollup[] }) {
  const parts = (["paid", "settled", "logging"] as const).map((state) => ({
    state,
    total: sumTotal(rows.filter((r) => r.state === state)),
    n: rows.filter((r) => r.state === state).length,
    label: state === "paid" ? "Paid" : state === "settled" ? "Ready to pay" : "Still logging",
  }));
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "16px 18px", marginBottom: 18 }}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>THIS MONTH · {monthLabel(MOCK.CURRENT_MONTH).toUpperCase()}</div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {parts.map((p) => (
          <div key={p.state} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatePill state={p.state} label={p.label} />
            <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{p.n} {p.n === 1 ? "coach" : "coaches"}</span>
            <span className="tabular" style={{ marginLeft: "auto", font: "800 16px var(--font-body)" }}>{fmt(p.total)} EGP</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pay() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data } = useAsync(loadYearRollups, []);

  useSetHeader({ kicker: "SETTLED · READY", title: "To Pay" }, []);

  if (!profile) return null;
  if (!data) return <Spinner />;

  // Everything settled but not yet paid, in any month of the year — a month
  // closing doesn't clear what is still owed from it. Oldest first.
  const due = data.map((m) => ({ month: m.month, rows: m.rows.filter((r) => r.state === "settled") })).filter((m) => m.rows.length > 0);
  const dueRows = due.flatMap((m) => m.rows);
  const thisMonth = data.find((m) => m.month === MOCK.CURRENT_MONTH)?.rows ?? [];

  const listRows = (month: string, rows: Rollup[]): ListRow[] =>
    rows.map((r) => ({
      id: r.coachId,
      name: r.name,
      avatarUrl: r.avatarUrl,
      title: r.name,
      meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? ""}`,
      sub: `SETTLED ${r.settledAt ? new Date(r.settledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toUpperCase() : ""}`.trim(),
      state: r.state,
      amount: r.total,
      onClick: () => navigate(`/pay/${r.coachId}`, { state: { month, from: "pay" } }),
    }));

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

      <MoneyHero
        label="DUE NOW · EGP"
        value={fmt(sumTotal(dueRows))}
        stats={[
          { k: "PAYEES", v: String(dueRows.length) },
          { k: "SESSIONS", v: String(dueRows.reduce((s, r) => s + r.count, 0)) },
          { k: "MONTHS", v: String(due.length) },
        ]}
      />

      <MonthStatus rows={thisMonth} />

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Payout queue</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{dueRows.length} due</span>
      </div>

      {due.length === 0 ? (
        <RollupTable colA="PAYEE" colB="METHOD" rows={[]} empty={{ icon: "topay", title: "Nothing to pay right now", body: "A coach appears here once a head settles their month. Paid months move to History." }} />
      ) : (
        due.map((m) => (
          <div key={m.month} style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "6px 2px 8px" }}>
              <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{monthLabel(m.month).toUpperCase()}</span>
              <span className="tabular" style={{ marginLeft: "auto", font: "700 13px var(--font-mono)", color: "var(--ink-muted)" }}>{fmt(sumTotal(m.rows))} EGP</span>
            </div>
            <RollupTable colA="PAYEE" colB="METHOD" rows={listRows(m.month, m.rows)} />
          </div>
        ))
      )}
      <div style={{ padding: "0 4px", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
        {dueRows.length > 0 ? "Tap a payee to see the full breakdown before paying." : null}
      </div>
    </div>
  );
}

import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { fmt } from "../lib/format";
import { HomeAvatar } from "../components/HomeAvatar";
import { MoneyHero } from "../components/MoneyHero";
import { RollupTable, type ListRow } from "../components/RollupTable";
import { Spinner } from "../components/Spinner";
import { canLog } from "../lib/types";

export function Pay() {
  const { profile } = useAuth();
  const month = MOCK.CURRENT_MONTH;
  const navigate = useNavigate();

  const { data } = useAsync(() => api.month(month), [month]);

  useSetHeader({ kicker: "SETTLED · READY", title: "To Pay" }, []);

  if (!profile) return null;
  if (!data) return <Spinner />;
  const rows = data.rows.filter((r) => canLog(r.role) && r.state === "settled");

  const rowItems: ListRow[] = rows.map((r) => ({
    id: r.coachId,
    name: r.name,
    avatarUrl: r.avatarUrl,
    title: r.name,
    meta: `${r.count} ${r.count === 1 ? "SESSION" : "SESSIONS"} · ${r.tierName ?? ""}`,
    sub: r.rate + " EGP/SESSION",
    state: r.state,
    amount: r.total,
    onClick: () => navigate(`/pay/${r.coachId}`, { state: { month } }),
  }));

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

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
        Tap a payee to see the full breakdown before paying.
      </div>
    </div>
  );
}

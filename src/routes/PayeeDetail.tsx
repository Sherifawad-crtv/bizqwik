import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { dateLabel, egp, fmt, monthShort } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { PackageStatusPill } from "../components/PackageStatusPill";
import type { PackageWithNames } from "../lib/types";

function PackageRow({ pkg }: { pkg: PackageWithNames }) {
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <span style={{ font: "700 16px var(--font-body)", letterSpacing: "-.01em" }}>{pkg.clientName}</span>
        <PackageStatusPill status={pkg.status} />
      </div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>
        {pkg.bundleName} · Sold {dateLabel(pkg.purchaseDate)}
      </div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 4 }}>
        {egp(pkg.priceAtSale)} paid · {egp(pkg.coachCutAtSale)} coach cut
      </div>
    </div>
  );
}

export function PayeeDetail() {
  const { coachId } = useParams<{ coachId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const month = (location.state as { month?: string })?.month ?? MOCK.CURRENT_MONTH;
  const [paying, setPaying] = useState(false);
  const id = coachId ?? "";

  const { data } = useAsync(async () => {
    const [monthRes, packagesRes] = await Promise.all([api.month(month), api.packagesByCoach(id, month)]);
    return { row: monthRes.rows.find((r) => r.coachId === id) ?? null, packages: packagesRes.packages };
  }, [id, month]);

  useSetHeader({ kicker: monthShort(month), title: data?.row?.name ?? "Payee" }, [month, data?.row?.name]);

  if (!data) return <Spinner />;
  if (!data.row) return null;
  const { row, packages } = data;

  return (
    <div>
      <button
        onClick={() => navigate("/pay")}
        style={{ display: "flex", alignItems: "center", gap: 4, border: 0, background: "none", cursor: "pointer", color: "var(--ink-muted)", font: "600 13px var(--font-body)", padding: "0 0 14px" }}
      >
        <Icon name="chevron-left" size={16} /> To Pay
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Avatar name={row.name} size={44} />
        <div>
          <div style={{ font: "800 22px var(--font-body)", letterSpacing: "-.01em" }}>{row.name}</div>
          <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{row.tierName ?? "No tier"} · {row.email}</div>
        </div>
      </div>

      <MoneyHero
        label="MONTH TOTAL · EGP"
        value={fmt(row.total)}
        stats={[
          { k: "GROUP", v: `${fmt(row.groupTotal)} EGP` },
          { k: "PRIVATE", v: `${fmt(row.privateTotal)} EGP` },
          { k: "STATE", v: row.state.toUpperCase() },
        ]}
      />

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "16px 18px", marginBottom: 18 }}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>WHERE IT'S COMING FROM</div>
        <div style={{ marginTop: 12 }}>
          <div style={{ font: "600 13px var(--font-mono)", color: "var(--ink-muted)" }}>GROUP SESSIONS</div>
          <div className="tabular" style={{ font: "700 15px var(--font-body)", marginTop: 2 }}>
            {row.count} × {fmt(row.rate)} EGP = {egp(row.groupTotal)}
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ font: "600 13px var(--font-mono)", color: "var(--ink-muted)" }}>PRIVATE TRAINING</div>
          <div className="tabular" style={{ font: "700 15px var(--font-body)", marginTop: 2 }}>
            {row.packageCount} {row.packageCount === 1 ? "package" : "packages"} = {egp(row.privateTotal)}
          </div>
        </div>
      </div>

      {row.state === "settled" && (
        <Button fullWidth size="lg" style={{ marginBottom: 18 }} onClick={() => setPaying(true)}>
          Mark paid · {fmt(row.total)} EGP
        </Button>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Private training</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{packages.length} sold this month</span>
      </div>

      {packages.length === 0 ? (
        <div
          data-sq
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--r-tile)",
            padding: "32px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            color: "var(--ink-faint)",
            font: "500 14px var(--font-body)",
          }}
        >
          <Icon name="clients" size={26} />
          No private packages sold this month.
        </div>
      ) : (
        packages.map((pkg) => <PackageRow key={pkg.id} pkg={pkg} />)
      )}

      <ConfirmSheet
        open={paying}
        onClose={() => setPaying(false)}
        kicker="MARK PAID"
        title={`Pay ${row.name}?`}
        sub={`${fmt(row.groupTotal)} EGP group + ${fmt(row.privateTotal)} EGP private = ${fmt(row.total)} EGP · ${month}. This records the payout as made in cash — it can't be undone from here.`}
        confirmLabel={`Mark paid · ${fmt(row.total)} EGP`}
        onConfirm={async () => {
          await api.pay(id, month);
          navigate("/pay");
        }}
      />
    </div>
  );
}

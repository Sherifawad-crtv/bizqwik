import { EmptyState } from "../components/EmptyState";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { dateLabel, egp, fmt, formatDateTime, monthShort, todayIso } from "../lib/format";
import { MoneyHero } from "../components/MoneyHero";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Spinner } from "../components/Spinner";
import { Sheet } from "../components/Sheet";
import { Segmented } from "../components/Segmented";
import { TextField } from "../components/FormField";
import { useSheetSuccess } from "../lib/useSheetSuccess";
import { SheetSuccessIcon } from "../components/SheetSuccessIcon";
import { isPartPaid, stateLabel } from "../lib/payables";
import { PackageStatusPill } from "../components/PackageStatusPill";
import type { PackageWithNames, Rollup, SettlementPayment } from "../lib/types";

const METHOD_LABELS: Record<string, string> = { cash: "Cash", bank: "Bank", instapay: "InstaPay", other: "Recorded earlier" };

/** Record a payment against a settled month: any amount up to what's left. */
function RecordPaymentSheet({ open, onClose, row, month }: { open: boolean; onClose: () => void; row: Rollup; month: string }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayIso());
  const [method, setMethod] = useState<"cash" | "bank" | "instapay">("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);
  const [doneLabel, setDoneLabel] = useState("Payment recorded");

  const reset = () => {
    setAmount(String(row.remaining));
    setDate(todayIso());
    setMethod("cash");
    setNote("");
    setError(null);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) reset(); }, [open]);
  if (!open) return null;

  const amt = Number(amount);
  const leftAfter = Number.isFinite(amt) ? row.remaining - amt : row.remaining;
  const submit = async () => {
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter the amount you paid.");
    if (amt > row.remaining) return setError(`Only ${fmt(row.remaining)} EGP is left to pay.`);
    if (!date || date > todayIso()) return setError("Choose today or an earlier date.");
    setBusy(true);
    setError(null);
    try {
      const r = await api.pay(row.coachId, month, { amount: amt, date, method, note: note.trim() || undefined });
      setDoneLabel(r.remaining <= 0 ? "Fully paid" : `Paid · ${fmt(r.remaining)} EGP left`);
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={busy ? () => {} : onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={doneLabel} iconIn={iconIn} />
      ) : (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>RECORD PAYMENT</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 4px" }}>Pay {row.name}</div>
          <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginBottom: 16 }}>
            {fmt(row.total)} EGP for {monthShort(month)} · {fmt(row.paidAmount)} paid · {fmt(row.remaining)} left
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TextField label="AMOUNT (EGP)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: `Group ${fmt(row.groupTotal)}`, value: row.groupTotal },
                { label: `Private ${fmt(row.privateTotal)}`, value: row.privateTotal },
                { label: `All ${fmt(row.remaining)}`, value: row.remaining },
              ]
                .filter((q) => q.value > 0 && q.value <= row.remaining)
                .map((q) => (
                  <button key={q.label} type="button" data-tap onClick={() => setAmount(String(q.value))} style={{ border: "1px solid var(--line)", background: "var(--sunken)", borderRadius: 999, padding: "8px 14px", font: "600 13px var(--font-body)", color: "var(--ink)", cursor: "pointer" }}>
                    {q.label}
                  </button>
                ))}
            </div>
            <TextField label="DATE PAID" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
            <div>
              <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "0 2px 6px" }}>METHOD</div>
              <Segmented value={method} onChange={(v) => setMethod(v as "cash" | "bank" | "instapay")} options={[{ value: "cash", label: "CASH" }, { value: "bank", label: "BANK" }, { value: "instapay", label: "INSTAPAY" }]} />
            </div>
            <TextField label="NOTE (OPTIONAL)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. group sessions" />
          </div>
          <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "10px 2px 0" }}>
            {Number.isFinite(leftAfter) && leftAfter > 0 ? `${fmt(leftAfter)} EGP will still be left to pay.` : leftAfter === 0 ? "This pays the month in full." : ""} The coach is notified.
          </div>
          {error && <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={submit}>
            {busy ? "Working…" : `Record payment · ${Number.isFinite(amt) && amt > 0 ? fmt(amt) : "0"} EGP`}
          </Button>
          <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>Cancel</Button>
        </>
      )}
    </Sheet>
  );
}

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
  const nav = (location.state as { month?: string; from?: "pay" | "history" } | null) ?? {};
  const month = nav.month ?? MOCK.CURRENT_MONTH;
  const backTo = nav.from === "history" ? { path: "/history", label: "History" } : { path: "/pay", label: "To Pay" };
  const [paying, setPaying] = useState(false);
  const id = coachId ?? "";

  const { data } = useAsync(async () => {
    const [monthRes, packagesRes, paymentsRes] = await Promise.all([api.month(month), api.packagesByCoach(id, month), api.payments(id, month)]);
    return { row: monthRes.rows.find((r) => r.coachId === id) ?? null, packages: packagesRes.packages, payments: paymentsRes.payments as SettlementPayment[] };
  }, [id, month]);

  useSetHeader({ kicker: monthShort(month), title: data?.row?.name ?? "Payee" }, [month, data?.row?.name]);

  if (!data) return <Spinner />;
  if (!data.row) return null;
  const { row, packages, payments } = data;

  return (
    <div>
      <button
        onClick={() => navigate(backTo.path)}
        style={{ display: "flex", alignItems: "center", gap: 4, border: 0, background: "none", cursor: "pointer", color: "var(--ink-muted)", font: "600 13px var(--font-body)", padding: "0 0 14px" }}
      >
        <Icon name="chevron-left" size={16} /> {backTo.label}
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Avatar name={row.name} size={44} src={row.avatarUrl} />
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
          { k: "STATE", v: stateLabel(row) },
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

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "16px 18px", marginBottom: 18 }}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>PAYMENT RECORD</div>
        {[
          ["Month", monthShort(month)],
          ["Settled", row.settledAt ? formatDateTime(row.settledAt) : "Not settled yet"],
          ["Paid", row.state === "paid" ? `${fmt(row.total)} EGP${row.paidAt ? ` · ${formatDateTime(row.paidAt)}` : ""}` : row.paidAmount > 0 ? `${fmt(row.paidAmount)} of ${fmt(row.total)} EGP` : "Not paid yet"],
          ...(row.state === "settled" ? [["Still to pay", `${fmt(row.remaining)} EGP`]] : []),
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
            <span style={{ font: "600 13px var(--font-mono)", color: "var(--ink-muted)" }}>{k}</span>
            <span className="tabular" style={{ marginLeft: "auto", font: "700 14px var(--font-body)", textAlign: "right" }}>{v}</span>
          </div>
        ))}
        {payments.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>PAYMENTS</div>
            {payments.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", font: "600 13px var(--font-mono)", color: "var(--ink-muted)" }}>{dateLabel(p.paidOn)} · {METHOD_LABELS[p.method] ?? p.method}</span>
                  {p.note && <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>{p.note}</span>}
                </span>
                <span className="tabular" style={{ marginLeft: "auto", font: "700 14px var(--font-body)", textAlign: "right" }}>{fmt(p.amount)} EGP</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {row.state === "settled" && (
        <Button fullWidth size="lg" style={{ marginBottom: 18 }} onClick={() => setPaying(true)}>
          {isPartPaid(row) ? "Record another payment" : "Record payment"}
        </Button>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Private training</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{packages.length} sold this month</span>
      </div>

      {packages.length === 0 ? (
        <EmptyState icon="clients" title="No PT packages sold this month" body="This coach's cut of any PT package sold with them this month shows up here." />
      ) : (
        packages.map((pkg) => <PackageRow key={pkg.id} pkg={pkg} />)
      )}

      <RecordPaymentSheet open={paying} onClose={() => setPaying(false)} row={row} month={month} />
    </div>
  );
}

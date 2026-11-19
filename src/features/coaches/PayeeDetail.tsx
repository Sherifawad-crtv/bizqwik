import { EmptyState } from "../../design-system/components/EmptyState";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useSetHeader } from "../../shared/screen/header";
import { useAsync } from "../../shared/api/useAsync";
import { api, MOCK } from "../../shared/api/backend";
import { dateLabel, egp, fmt, formatDateTime, monthShort, todayIso } from "../../shared/format";
import { MoneyHero } from "../../design-system/components/MoneyHero";
import { Avatar } from "../../design-system/components/Avatar";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Spinner } from "../../design-system/components/Spinner";
import { Sheet } from "../../design-system/components/Sheet";
import { Segmented } from "../../design-system/components/Segmented";
import { TextField } from "../../design-system/components/FormField";
import { useSheetSuccess } from "../../design-system/components/useSheetSuccess";
import { useMountedThroughExit } from "../../shared/useLatch";
import { SheetSuccessIcon } from "../../design-system/components/SheetSuccessIcon";
import { isPartPaid, stateLabel } from "./payables";
import { PackageStatusPill } from "../../shared/components/PackageStatusPill";
import type { PackageWithNames, Rollup, SettlementPayment } from "../../shared/types";
import { useBackAction } from "../../shared/screen/floatingActions";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { Num } from "../../design-system/components/Num";
import "./PayeeDetail.css";

const METHOD_LABELS: Record<string, string> = { cash: "Cash", bank: "Bank", instapay: "InstaPay", other: "Recorded earlier" };

/** Record a payment against a settled month: any amount up to what's left. */
function RecordPaymentSheet({ open, onClose, row, month }: { open: boolean; onClose: () => void; row: Rollup; month: string }) {
  const mounted = useMountedThroughExit(open);
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
  // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) reset(); }, [open]);
  if (!mounted) return null;

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
          <div className="bq-label">RECORD PAYMENT</div>
          <div className="bq-coaches-payee-detail-record-payment-sheet-title">Pay {row.name}</div>
          <div className="bq-coaches-payee-detail-record-payment-sheet-meta">
            {fmt(row.total)} EGP for {monthShort(month)} · {fmt(row.paidAmount)} paid · {fmt(row.remaining)} left
          </div>
          <div className="bq-flex bq-col bq-gap-3">
            <TextField label="AMOUNT (EGP)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            <div className="bq-flex bq-gap-2 bq-wrap">
              {[
                { label: `Group ${fmt(row.groupTotal)}`, value: row.groupTotal },
                { label: `Private ${fmt(row.privateTotal)}`, value: row.privateTotal },
                { label: `All ${fmt(row.remaining)}`, value: row.remaining },
              ]
                .filter((q) => q.value > 0 && q.value <= row.remaining)
                .map((q) => (
                  <button key={q.label} type="button" className="bq-scale bq-coaches-payee-detail-record-payment-sheet-btn" onClick={() => setAmount(String(q.value))}>
                    {q.label}
                  </button>
                ))}
            </div>
            <TextField label="DATE PAID" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
            <div>
              <div className="bq-coaches-payee-detail-record-payment-sheet-label">METHOD</div>
              <Segmented value={method} onChange={(v) => setMethod(v as "cash" | "bank" | "instapay")} options={[{ value: "cash", label: "CASH" }, { value: "bank", label: "BANK" }, { value: "instapay", label: "INSTAPAY" }]} />
            </div>
            <TextField label="NOTE (OPTIONAL)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. group sessions" />
          </div>
          <div className="bq-coaches-payee-detail-record-payment-sheet-meta-2">
            {Number.isFinite(leftAfter) && leftAfter > 0 ? `${fmt(leftAfter)} EGP will still be left to pay.` : leftAfter === 0 ? "This pays the month in full." : ""} The coach is notified.
          </div>
          {error && <div  className="bq-error bq-error--spaced bq-rise">{error}</div>}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={submit}>
            {busy ? "Working…" : `Record payment · ${Number.isFinite(amt) && amt > 0 ? fmt(amt) : "0"} EGP`}
          </Button>
          <Button className="bq-mt-2" variant="quiet" fullWidth onClick={onClose} disabled={busy}>Cancel</Button>
        </>
      )}
    </Sheet>
  );
}

function PackageRow({ pkg }: { pkg: PackageWithNames }) {
  return (
    <div className="bq-card bq-card--sm bq-mb-10px">
      <div className="bq-flex bq-items-center bq-justify-between bq-gap-10px bq-mb-6px">
        <span className="bq-coaches-payee-detail-package-row-title">{pkg.clientName}</span>
        <PackageStatusPill status={pkg.status} />
      </div>
      <div className="bq-coaches-payee-detail-package-row-meta">
        {pkg.bundleName} · Sold {dateLabel(pkg.purchaseDate)}
      </div>
      <div className="bq-coaches-payee-detail-package-row-meta-2">
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
  useBackAction(() => navigate(backTo.path));
  const isMobile = useIsMobile();
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
      {!isMobile && (
      <button className="bq-coaches-payee-detail-btn"
        onClick={() => navigate(backTo.path)}
      >
        <Icon name="chevron-left" size={16} /> {backTo.label}
      </button>
      )}

      <div className="bq-flex bq-items-center bq-gap-3 bq-mb-18px">
        <Avatar name={row.name} size={44} src={row.avatarUrl} />
        <div>
          <div className="bq-coaches-payee-detail-title">{row.name}</div>
          <div className="bq-meta">{row.tierName ?? "No tier"} · {row.email}</div>
        </div>
      </div>

      <MoneyHero
        label="MONTH TOTAL · EGP"
        value={<Num value={row.total} />}
        stats={[
          { k: "GROUP", v: `${fmt(row.groupTotal)} EGP` },
          { k: "PRIVATE", v: `${fmt(row.privateTotal)} EGP` },
          { k: "STATE", v: stateLabel(row) },
        ]}
      />

      <div className="bq-card bq-coaches-payee-detail-spacing">
        <div className="bq-label">WHERE IT'S COMING FROM</div>
        <div className="bq-mt-3">
          <div className="bq-coaches-payee-detail-meta">GROUP SESSIONS</div>
          <div className="tabular bq-coaches-payee-detail-title-2">
            {row.count} × {fmt(row.rate)} EGP = {egp(row.groupTotal)}
          </div>
        </div>
        <div className="bq-mt-3">
          <div className="bq-coaches-payee-detail-meta">PRIVATE TRAINING</div>
          <div className="tabular bq-coaches-payee-detail-title-2">
            {row.packageCount} {row.packageCount === 1 ? "package" : "packages"} = {egp(row.privateTotal)}
          </div>
        </div>
      </div>

      <div className="bq-card bq-coaches-payee-detail-spacing">
        <div className="bq-label">PAYMENT RECORD</div>
        {[
          ["Month", monthShort(month)],
          ["Settled", row.settledAt ? formatDateTime(row.settledAt) : "Not settled yet"],
          ["Paid", row.state === "paid" ? `${fmt(row.total)} EGP${row.paidAt ? ` · ${formatDateTime(row.paidAt)}` : ""}` : row.paidAmount > 0 ? `${fmt(row.paidAmount)} of ${fmt(row.total)} EGP` : "Not paid yet"],
          ...(row.state === "settled" ? [["Still to pay", `${fmt(row.remaining)} EGP`]] : []),
        ].map(([k, v]) => (
          <div className="bq-flex bq-items-baseline bq-gap-10px bq-mt-10px" key={k}>
            <span className="bq-coaches-payee-detail-meta">{k}</span>
            <span className="tabular bq-coaches-payee-detail-title-3">{v}</span>
          </div>
        ))}
        {payments.length > 0 && (
          <div className="bq-coaches-payee-detail-part">
            <div className="bq-label">PAYMENTS</div>
            {payments.map((p) => (
              <div className="bq-flex bq-items-baseline bq-gap-10px bq-mt-10px" key={p.id}>
                <span className="bq-min-w-0">
                  <span className="bq-coaches-payee-detail-meta-2">{dateLabel(p.paidOn)} · {METHOD_LABELS[p.method] ?? p.method}</span>
                  {p.note && <span className="bq-coaches-payee-detail-meta-3">{p.note}</span>}
                </span>
                <span className="tabular bq-coaches-payee-detail-title-3">{fmt(p.amount)} EGP</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {row.state === "settled" && (
        <Button className="bq-mb-18px" fullWidth size="lg" onClick={() => setPaying(true)}>
          {isPartPaid(row) ? "Record another payment" : "Record payment"}
        </Button>
      )}

      <div className="bq-coaches-payee-detail-row">
        <span className="bq-h2">Private training</span>
        <span className="bq-meta">{packages.length} sold this month</span>
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

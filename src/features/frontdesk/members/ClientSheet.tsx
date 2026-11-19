import { Reveal } from "../../../design-system/components/Reveal";
import { useEffect, useState } from "react";
import { useLatch } from "../../../shared/useLatch";
import { useSheetSuccess } from "../../../design-system/components/useSheetSuccess";
import { api, type SalePartner } from "../../../shared/api/backend";
import { fmt, dateLabel } from "../../../shared/format";
import type { BundleType, ClassSeries, ClientWithPackage, CoachOption, GroupPlanType } from "../../../shared/types";
import { LocationField, locationName, useCurrentLocation, useLocations } from "../../../shared/locations";
import { Button } from "../../../design-system/components/Button";
import { Sheet } from "../../../design-system/components/Sheet";
import { Segmented } from "../../../design-system/components/Segmented";
import { SheetSuccessIcon } from "../../../design-system/components/SheetSuccessIcon";
import { TextField, SelectField } from "../../../design-system/components/FormField";
import { PaymentSelect } from "../../../shared/components/PaymentSelect";
import { Icon } from "../../../design-system/components/Icon";
import type { PayMethod } from "../../../shared/types";
import { useAuth } from "../../../shared/auth";
import { SheetHeading } from "../shared";
import { PlanPill } from "../../../shared/components/PlanPill";
import { ErrorBanner } from "../../../design-system/components/ErrorBanner";
import { endingSoon, planSummary, renewalMessage, whatsappUrl } from "../../../shared/deskStatus";
import { bundleOptions, coachOptions, offerOf } from "./offers";
import { GroupOfferSelect, PartnerPicker } from "./partners";
import { inviteNewPartners } from "./invitePartners";
import "./ClientSheet.css";

type Mode = "view" | "sell-plan" | "renew-package" | "assign" | "invite" | "refund" | "pt-log" | "location";

export function ClientSheet({
  client,
  onClose,
  startIn,
  onSold,
  planTypes,
  series,
  bundleTypes,
  coaches,
  onCheckIn,
}: {
  client: ClientWithPackage | null;
  onClose: () => void;
  onCheckIn: (c: ClientWithPackage) => void;
  /** Open straight on a selling step (renewing from the check-in sheet). */
  startIn?: "sell-plan" | "renew-package";
  /** A plan or package was just sold. */
  onSold?: () => void;
  planTypes: GroupPlanType[];
  series: ClassSeries[];
  bundleTypes: BundleType[];
  coaches: CoachOption[];
}) {
  const shown = useLatch(client);
  const { profile: me, orgMode: om } = useAuth();
  const solo = me?.role === "dept_head" && om === "solo";
  const sheetLocations = useLocations();
  const { current: sheetHere } = useCurrentLocation();
  const [locPick, setLocPick] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [pickId, setPickId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [email, setEmail] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDest, setRefundDest] = useState<"wallet" | "desk">("wallet");
  const [refundNote, setRefundNote] = useState("");
  // What they've paid less what's already been refunded: the most this refund can be.
  const [refundable, setRefundable] = useState<{ paid: number; refunded: number; refundable: number } | null>(null);
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [partners, setPartners] = useState<SalePartner[]>([]);
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = !!client;
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (client) {
      setMode(startIn ?? "view");
      setShowMore(false);
      // Renewing starts from what they had last, still sellable now: one tap to renew, changeable.
      const lastPlan = client.lastGroupPlan;
      const lastOffer = lastPlan?.planTypeId && planTypes.some((t) => t.id === lastPlan.planTypeId) ? `pt:${lastPlan.planTypeId}` : lastPlan?.seriesId && series.some((x) => x.id === lastPlan.seriesId) ? `cs:${lastPlan.seriesId}` : "";
      const lastBundle = client.currentPackage && bundleTypes.some((b) => b.id === client.currentPackage!.bundleTypeId) ? client.currentPackage.bundleTypeId : "";
      setPickId(startIn === "sell-plan" ? lastOffer : startIn === "renew-package" ? lastBundle : "");
      setCoachId(client.assignedCoachId ?? "");
      setEmail(client.email ?? "");
      setRefundAmount("");
      setRefundDest("wallet");
      setRefundNote("");
      setRefundable(null);
      setPayMethod("cash");
      setPartners([]);
      setLocPick(client.homeLocationId ?? null);
      setError(null);
    }
    // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  useEffect(() => {
    if (mode !== "refund" || !client) return;
    let alive = true;
    api.refundable(client.id).then((r) => alive && setRefundable(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
    // Deliberate: fetch when the mode or the person changes, not on every edit of the client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, client?.id]);

  if (!shown) return null;

  const plan = shown.groupPlan ?? null;
  const pkg = shown.currentPackage;
  const packageActive = pkg?.status === "active";
  const bType = pkg ? bundleTypes.find((b) => b.id === pkg.bundleTypeId) : undefined;
  const summary = planSummary(shown, bundleTypes);
  const sharedType = mode === "sell-plan" && pickId.startsWith("pt:") ? planTypes.find((t) => t.id === pickId.slice(3) && t.sharedSeats) ?? null : null;
  const coachName = coaches.find((c) => c.id === shown.assignedCoachId)?.name ?? null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (mode === "sell-plan" || mode === "renew-package") onSold?.();
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirmMode = () => {
    if (mode === "sell-plan") {
      if (!pickId) return setError("Choose a plan.");
      if (sharedType && partners.length < sharedType.sharedSeats! - 1) return setError(`Choose who ${shown.name} shares this with.`);
      return run(async () => {
        const res = await api.sellGroupPlan({ clientId: shown.id }, offerOf(pickId), payMethod, sharedType ? partners : undefined);
        await inviteNewPartners(res.sharedWith, partners);
      });
    }
    if (mode === "renew-package") {
      const trainer = solo && me ? me.id : coachId;
      if (!pickId || !trainer) return setError(solo ? "Choose a package." : "Choose a package and a coach.");
      return run(() => api.sellPackage(shown.id, pickId, trainer, payMethod));
    }
    if (mode === "location") {
      return run(() => api.setClientLocation(shown.id, locPick));
    }
    if (mode === "assign") {
      if (!coachId) return setError("Choose a coach.");
      return run(() => api.assignCoach(shown.id, coachId));
    }
    if (mode === "invite") {
      const e = email.trim();
      if (!/^\S+@\S+\.\S+$/.test(e)) return setError("Enter a valid email.");
      return run(() => api.inviteClient(shown.id, e));
    }
    if (mode === "refund") {
      const amt = Number(refundAmount);
      if (!Number.isFinite(amt) || amt <= 0) return setError("Enter a refund amount.");
      if (refundable && amt > refundable.refundable) return setError(refundable.refundable > 0 ? `The most you can refund ${shown.name} is ${fmt(refundable.refundable)} EGP.` : `${shown.name} has nothing left to refund.`);
      const note = [solo && refundDest === "desk" ? "InstaPay" : "", refundNote.trim()].filter(Boolean).join(" · ");
      return run(() => api.refundClient(shown.id, amt, refundDest, note || undefined));
    }
  };

  const successLabel =
    mode === "assign"
      ? "Coach assigned"
      : mode === "invite"
        ? "Invitation sent"
        : mode === "refund"
          ? refundDest === "wallet" ? "Refunded to wallet" : "Refund recorded"
          : mode === "sell-plan"
            ? "Plan started"
            : mode === "pt-log"
              ? "PT session logged"
              : mode === "location"
                ? "Location saved"
                : "Package sold";

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        {confirmed ? (
          <SheetSuccessIcon label={successLabel} iconIn={iconIn} />
        ) : mode === "view" ? (
          <>
            <SheetHeading kicker="CLIENT" title={shown.name} />
            {shown.phone && <div className="bq-frontdesk-client-sheet-meta">{shown.phone}</div>}

            <div className="bq-frontdesk-client-sheet-box">
              <div className="bq-flex bq-items-center bq-gap-10px">
                <div className="bq-frontdesk-client-sheet-title">{summary.title}</div>
                <PlanPill client={shown} />
              </div>
              <div className="bq-frontdesk-client-sheet-meta-2">{summary.detail}</div>
              {plan && plan.kind === "bundle" && <div className="bq-frontdesk-client-sheet-meta-3">Until {dateLabel(plan.expiresAt.slice(0, 10))}</div>}
              {packageActive && plan && (
                <div className="bq-frontdesk-client-sheet-text">
                  + {bType?.name ?? "Package"}: {pkg!.sessionsRemaining} of {pkg!.sessionsIncluded} sessions left
                </div>
              )}
              {coachName && !solo && <div className="bq-frontdesk-client-sheet-meta-4">Coach: {coachName}</div>}
              {sheetLocations.length > 0 && (
                <div className="bq-frontdesk-client-sheet-meta-4">Location: {locationName(sheetLocations, shown.homeLocationId) ?? "Not set"}</div>
              )}
            </div>
            {solo && packageActive && pkg && me && pkg.coachId === me.id && (
              <Button className="bq-mt-3"
                variant="secondary"
                fullWidth
                disabled={busy}
                onClick={async () => {
                  setMode("pt-log");
                  setBusy(true);
                  setError(null);
                  try {
                    await api.logPtSession(pkg.id);
                    showSuccess();
                  } catch (err) {
                    setMode("view");
                    setError(err instanceof Error ? err.message : "Couldn't log the session.");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Log today's PT session · {pkg.sessionsRemaining} left
              </Button>
            )}

            {error && <ErrorBanner text={error} />}

            {summary.tone === "active" ? (
              // Selling sits next to checking in — the desk's two jobs. A new group plan
              // can only start once the running one ends, so "Sell" offers what can be
              // sold now: a group plan if none is running, else a PT package.
              <div className="bq-flex bq-gap-2 bq-mt-4">
                <Button className="bq-frontdesk-client-sheet-btn" fullWidth size="lg" onClick={() => onCheckIn(shown)}>
                  Check in
                </Button>
                {(!plan || !packageActive) && (
                  <Button className="bq-flex-1" variant="secondary" size="lg" onClick={() => setMode(!plan ? "sell-plan" : "renew-package")}>
                    {!plan ? "Sell plan" : "Sell PT"}
                  </Button>
                )}
              </div>
            ) : (
              <Button className="bq-mt-4" fullWidth size="lg" onClick={() => setMode(plan ? "renew-package" : "sell-plan")}>
                Sell a plan
              </Button>
            )}

            {(summary.tone !== "active" || endingSoon(shown) !== null) && whatsappUrl(shown.phone, "") && (
              <Button className="bq-mt-2"
                variant="secondary"
                fullWidth
                onClick={() => window.open(whatsappUrl(shown.phone, renewalMessage(shown, bundleTypes))!, "_blank", "noopener")}
              >
                {summary.tone === "active" ? "Remind to renew on WhatsApp" : "Message on WhatsApp"}
              </Button>
            )}

            <button
              className="bq-scale bq-frontdesk-client-sheet-btn-2"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
            >
              {showMore ? "Fewer options" : "More options"}
            </button>
            <Reveal show={showMore}>
              <div className="bq-frontdesk-client-sheet-box-2">
                {[
                  !plan && summary.tone === "active" ? { label: "Sell a group plan", go: () => setMode("sell-plan") } : null,
                  !packageActive ? { label: pkg ? "Renew package" : "Sell a package", go: () => setMode("renew-package") } : null,
                  !packageActive && !solo ? { label: coachName ? "Change coach" : "Assign a coach", go: () => setMode("assign") } : null,
                  sheetLocations.length > 0 ? { label: shown.homeLocationId ? "Change location" : "Set location", go: () => setMode("location") } : null,
                  { label: shown.email ? "Re-invite to app" : "Invite to app", go: () => setMode("invite") },
                  { label: "Issue a refund", go: () => setMode("refund"), danger: true },
                ]
                  .filter((x): x is { label: string; go: () => void; danger?: boolean } => !!x)
                  .map((x, i, arr) => (
                    <button
                      key={x.label}
                      className="bq-scale"
                      onClick={x.go}
                      style={{ display: "flex", alignItems: "center", width: "100%", minHeight: 52, padding: "0 16px", border: 0, borderBottom: i === arr.length - 1 ? "none" : "var(--border-divider)", background: "none", cursor: "pointer", textAlign: "left", font: "600 var(--text-body-size) var(--font-family-body)", color: x.danger ? "var(--color-text-status-danger-default)" : "var(--color-text-primary-default)" }}
                    >
                      <span className="bq-flex-1">{x.label}</span>
                      <Icon name="chevron-right" size={16} />
                    </button>
                  ))}
              </div>
            </Reveal>
          </>
        ) : (
          <>
            <SheetHeading
              kicker={shown.name.toUpperCase()}
              title={mode === "assign" ? "Assign a coach" : mode === "invite" ? "Invite to app" : mode === "refund" ? "Issue a refund" : mode === "sell-plan" ? "Choose a plan" : "Choose package"}
            />
            <div className="bq-stack">
              {mode === "refund" && (
                <>
                  <TextField label="AMOUNT (EGP)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} inputMode="decimal" placeholder="0" />
                  {refundable && (
                    <div className="bq-frontdesk-client-sheet-meta-5">
                      Up to {fmt(refundable.refundable)} EGP · {fmt(refundable.paid)} paid, {fmt(refundable.refunded)} already refunded.
                    </div>
                  )}
                  <Segmented
                    value={refundDest}
                    options={[
                      { value: "wallet", label: "To wallet" },
                      { value: "desk", label: solo ? "InstaPay" : "Cash / card" },
                    ]}
                    onChange={(v) => setRefundDest(v as "wallet" | "desk")}
                  />
                  <div className="bq-frontdesk-client-sheet-meta-5">
                    {refundDest === "wallet"
                      ? "Adds store credit to their wallet (expires per the org's policy)."
                      : solo ? "You send the money yourself on InstaPay — this just records it." : "You hand back cash/card outside Bizqwik — this just records the amount."}
                  </div>
                  <TextField label="NOTE (OPTIONAL)" value={refundNote} onChange={(e) => setRefundNote(e.target.value)} placeholder="Reason for the refund" />
                </>
              )}
              {mode === "invite" && (
                <>
                  <TextField label="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="member@email.com" />
                  <div className="bq-frontdesk-client-sheet-meta-5">
                    They'll use this email to sign in to the branded member app.
                  </div>
                </>
              )}
              {mode === "location" && <LocationField locations={sheetLocations} value={locPick} onChange={setLocPick} />}
              {mode === "sell-plan" && <GroupOfferSelect value={pickId} onChange={(v) => { setPickId(v); setPartners([]); }} planTypes={planTypes} series={series} />}
              {sharedType && <PartnerPicker type={sharedType} buyerId={shown.id} picked={partners} onChange={setPartners} />}
              {mode === "renew-package" && <SelectField label="PACKAGE" value={pickId} onChange={setPickId} placeholder="Choose a package" options={bundleOptions(bundleTypes, sheetLocations, shown.homeLocationId ?? sheetHere?.id ?? null)} empty={{ title: "No PT packages yet", body: solo ? "Add PT bundles in Plans → PT bundles. Once one exists you can sell it here." : "The department head adds PT packages in Catalog → PT bundles. Once one exists you can sell it here." }} />}
              {((mode === "renew-package" && !solo) || mode === "assign") && (
                <SelectField label="COACH" value={coachId} onChange={setCoachId} placeholder="Choose a coach" options={coachOptions(coaches)} empty={{ title: "No coaches yet", body: "The department head invites coaches from Team → Team & tiers. They appear here once they sign up." }} />
              )}
              {(mode === "sell-plan" || mode === "renew-package") && (
                <PaymentSelect value={payMethod} onChange={setPayMethod} wallet={!sharedType} />
              )}
            </div>
            {error && <ErrorBanner text={error} />}
            <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={confirmMode}>
              {busy ? "Saving…" : mode === "assign" ? "Assign coach" : mode === "invite" ? "Send invitation" : mode === "refund" ? "Issue refund" : mode === "sell-plan" ? "Start plan" : mode === "location" ? "Save location" : "Sell package"}
            </Button>
            <Button className="bq-mt-2"
              variant="secondary"
              fullWidth
              disabled={busy}
              onClick={() => {
                setMode("view");
                setError(null);
              }}
            >
              Back
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}

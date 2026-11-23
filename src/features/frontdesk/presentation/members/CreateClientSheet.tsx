import { useMountedThroughExit } from "../../../../shared/useLatch";
import { useEffect, useState } from "react";
import { useSheetSuccess } from "../../../../design-system/components/useSheetSuccess";
import { type SalePartner } from "../../../../shared/api/backend";
import { desk } from "../hooks/useDesk";
import { fmt } from "../../../../shared/format";
import type { BundleType, ClassSeries, CoachOption, GroupPlanType } from "../../../../shared/types";
import { useCurrentLocation, useLocations } from "../../../../shared/locations";
import { Button } from "../../../../design-system/components/Button";
import { Sheet } from "../../../../design-system/components/Sheet";
import { Segmented } from "../../../../design-system/components/Segmented";
import { SheetSuccessIcon } from "../../../../design-system/components/SheetSuccessIcon";
import { TextField, SelectField } from "../../../../design-system/components/FormField";
import { PaymentCards } from "../../../../shared/components/PaymentCards";
import type { PayMethod } from "../../../../shared/types";
import { useAuth } from "../../../../shared/auth";
import { SheetHeading } from "../shared";
import { ErrorBanner } from "../../../../design-system/components/ErrorBanner";
import { Card } from "../../../../design-system/components/Card";
import { type PlanKind, bundleOptions, coachOptions, offerOf } from "./offers";
import { GroupOfferSelect, PartnerPicker } from "./partners";
import "./CreateClientSheet.css";

const CREATE_STEPS = ["Client info", "Package", "Payment", "Summary"] as const;

/** New client, one thing at a time: who they are, what they're buying, how
 * they pay, then a summary to check before anything is created. */
export function CreateClientSheet({
  open,
  onClose,
  planTypes,
  series,
  bundleTypes,
  coaches,
  takenEmails = [],
}: {
  open: boolean;
  onClose: () => void;
  takenEmails?: string[];
  planTypes: GroupPlanType[];
  series: ClassSeries[];
  bundleTypes: BundleType[];
  coaches: CoachOption[];
}) {
  const mounted = useMountedThroughExit(open);
  const { profile, orgMode } = useAuth();
  const [step, setStep] = useState(0);
  const [kind, setKind] = useState<PlanKind>("plan");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [offer, setOffer] = useState("");
  const [bundleTypeId, setBundleTypeId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("cash");
  const [partners, setPartners] = useState<SalePartner[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createLocations = useLocations();
  const { current: createCurrent } = useCurrentLocation();
  const createHere = createLocations.length > 1 ? (createCurrent?.id ?? null) : null;
  // A solo owner is the trainer on every PT package she sells.
  const soloTrainer = profile?.role === "dept_head" && orgMode === "solo" ? (coaches[0]?.id ?? "") : "";
  useEffect(() => {
    if (soloTrainer && coachId !== soloTrainer) setCoachId(soloTrainer);
  }, [soloTrainer, coachId]);
  // Set once the client exists, so a retry after a failed invite only re-sends the invite.
  const [createdId, setCreatedId] = useState<string | null>(null);
  // New partners of a shared sale still to be invited (a failed invite is retried on resubmit).
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string }[]>([]);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (open) {
      setStep(0);
      setCreatedId(null);
      setPartners([]);
      setPendingInvites([]);
      setKind("plan");
      setName("");
      setPhone("");
      setEmail("");
      setOffer("");
      setBundleTypeId("");
      setCoachId("");
      setPayMethod("cash");
      setError(null);
    }
  }, [open]);

  if (!mounted) return null;

  const mail = email.trim().toLowerCase();
  const sharedType = kind === "plan" && offer.startsWith("pt:") ? (planTypes.find((t) => t.id === offer.slice(3) && t.sharedSeats) ?? null) : null;

  // What's wrong with a step, if anything. Email is how the client signs in
  // to the member app, so it's required.
  const problem = (s: number): string | null => {
    if (s === 0) {
      if (!name.trim() || !phone.trim()) return "Name and phone number are required.";
      if (!/^\S+@\S+\.\S+$/.test(mail)) return "Enter the client's email — they sign in to the app with it.";
      if (!createdId && takenEmails.some((e) => e.trim().toLowerCase() === mail)) return "Another client already uses this email.";
    }
    if (s === 1) {
      if (kind === "plan" && !offer) return "Choose a plan.";
      if (sharedType && partners.length < sharedType.sharedSeats! - 1) return "Choose who this client shares the plan with.";
      if (kind === "service" && (!bundleTypeId || !coachId)) return "Choose a package and a coach.";
    }
    return null;
  };

  const next = () => {
    const msg = problem(step);
    if (msg) return setError(msg);
    setError(null);
    setStep(step + 1);
  };
  const back = () => {
    setError(null);
    setStep(step - 1);
  };

  const submit = async () => {
    const msg = problem(0) ?? problem(1);
    if (msg) return setError(msg);
    const fields = { name: name.trim(), phone: phone.trim(), email: mail };
    setBusy(true);
    setError(null);
    try {
      let clientId = createdId;
      let invites = pendingInvites;
      if (!clientId) {
        const res = kind === "plan" ? await desk.sellGroupPlan(fields, offerOf(offer), payMethod, sharedType ? partners : undefined) : await desk.createServiceClient(fields, bundleTypeId, coachId, payMethod);
        clientId = res.client.id;
        setCreatedId(clientId);
        const shared = "sharedWith" in res ? res.sharedWith : undefined;
        invites = partners.flatMap((p, i) => ("email" in p && shared?.[i] ? [{ id: shared[i].id, email: p.email }] : []));
        setPendingInvites(invites);
        // A new client belongs to the location she's working at.
        if (createHere) await desk.setClientLocation(clientId, createHere).catch(() => undefined);
      }
      // Register the app invite so the client can sign up with this email.
      try {
        await desk.inviteClient(clientId, mail);
      } catch (err) {
        setError(`Client created, but the app invite failed: ${err instanceof Error ? err.message : "try again"}. Submitting again only re-sends the invite.`);
        return;
      }
      // The shared bundle's new partners need theirs too.
      for (const inv of invites) {
        try {
          await desk.inviteClient(inv.id, inv.email);
        } catch (err) {
          setError(`Sold, but an app invite failed: ${err instanceof Error ? err.message : "try again"}. Submitting again only re-sends the invites.`);
          return;
        }
        invites = invites.filter((x) => x.id !== inv.id);
        setPendingInvites(invites);
      }
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // The chosen package as the summary describes it.
  const chosen = (() => {
    if (kind === "plan") {
      if (offer.startsWith("cs:")) {
        const x = series.find((r) => r.id === offer.slice(3));
        return x ? { title: `${x.title} monthly`, detail: "1 month", price: x.monthlyPrice } : null;
      }
      const t = planTypes.find((r) => r.id === offer.slice(3));
      if (!t) return null;
      const months = `${t.durationMonths} month${t.durationMonths === 1 ? "" : "s"}`;
      return { title: t.name, detail: t.kind === "bundle" ? `${t.sharedSeats ? `${t.credits! / t.sharedSeats} classes each` : `${t.credits} classes`} · ${months}` : `All classes · ${months}`, price: t.price };
    }
    const b = bundleTypes.find((r) => r.id === bundleTypeId);
    return b ? { title: b.name, detail: `${b.sessionsIncluded} PT sessions`, price: b.price } : null;
  })();
  const coachName = coaches.find((c) => c.id === coachId)?.name ?? null;

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label="Client created · app invite ready" iconIn={iconIn} />
      ) : (
        <>
          <SheetHeading kicker={`NEW CLIENT · STEP ${step + 1} OF ${CREATE_STEPS.length}`} title={CREATE_STEPS[step]} />
          <div className="bq-frontdesk-create-client-sheet-row" aria-hidden>
            {CREATE_STEPS.map((s, i) => (
              <span className="bq-frontdesk-create-client-sheet-box" key={s} style={{ background: i <= step ? "var(--color-bg-fill-primary-default)" : "var(--color-border-primary-default)" }} />
            ))}
          </div>

          {step === 0 && (
            <div className="bq-stack">
              <TextField label="FULL NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" autoComplete="off" />
              <TextField label="PHONE" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" autoComplete="off" />
              <TextField label="EMAIL" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </div>
          )}

          {step === 1 && (
            <>
              {!(profile?.role === "dept_head" && orgMode === "solo" && bundleTypes.length === 0) && (
              <div className="bq-flex bq-justify-center bq-mb-4">
                <Segmented
                  value={kind}
                  onChange={(v) => {
                    setKind(v);
                    setError(null);
                  }}
                  options={[
                    { value: "plan", label: "GROUP PLAN" },
                    { value: "service", label: "PT PACKAGE" },
                  ]}
                />
              </div>
              )}
              <div className="bq-stack">
                {kind === "plan" ? (
                  <>
                    <GroupOfferSelect value={offer} onChange={(v) => { setOffer(v); setPartners([]); }} planTypes={planTypes} series={series} />
                    {sharedType && <PartnerPicker type={sharedType} buyerId={null} picked={partners} onChange={setPartners} />}
                  </>
                ) : (
                  <>
                    <SelectField label="PACKAGE" value={bundleTypeId} onChange={setBundleTypeId} placeholder="Choose a package" options={bundleOptions(bundleTypes, createLocations, createHere)} empty={{ title: "No PT packages yet", body: soloTrainer ? "Add PT bundles in Plans → PT bundles. Once one exists you can sell it here." : "The department head adds PT packages in Catalog → PT bundles. Once one exists you can sell it here." }} />
                    {!soloTrainer && <SelectField label="COACH" value={coachId} onChange={setCoachId} placeholder="Choose a coach" options={coachOptions(coaches)} empty={{ title: "No coaches yet", body: "The department head invites coaches from Team → Team & tiers. They appear here once they sign up." }} />}
                  </>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <PaymentCards value={payMethod} onChange={setPayMethod} />
              <div className="bq-frontdesk-create-client-sheet-meta">A new client has no wallet yet, so it's cash or card.</div>
            </>
          )}

          {step === 3 && (
            <>
              <Card className="bq-overflow-hidden" pad="none">
                {(
                  [
                    ["CLIENT", name.trim()],
                    ["PHONE", phone.trim()],
                    ["EMAIL", mail],
                    ["PACKAGE", chosen ? `${chosen.title} · ${chosen.detail}` : "—"],
                    ...(sharedType ? [["SHARED WITH", partners.map((p) => ("name" in p ? p.name : (p.label ?? "client"))).join(", ")]] : []),
                    ...(kind === "service" ? [["COACH", coachName ?? "—"]] : []),
                    ["PAYMENT", payMethod.toUpperCase()],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div className="bq-frontdesk-create-client-sheet-row-2" key={k}>
                    <span className="bq-frontdesk-create-client-sheet-label">{k}</span>
                    <span className="bq-frontdesk-create-client-sheet-text">{v}</span>
                  </div>
                ))}
                <div className="bq-frontdesk-create-client-sheet-row-3">
                  <span className="bq-frontdesk-create-client-sheet-label-2">TOTAL TO COLLECT</span>
                  <span className="tabular bq-frontdesk-create-client-sheet-title">{chosen ? `${fmt(chosen.price)} EGP` : "—"}</span>
                </div>
              </Card>
              <div className="bq-frontdesk-create-client-sheet-meta">Creating the client also sends the app invite to {mail}.</div>
            </>
          )}

          {error && <ErrorBanner text={error} />}
          {step < 3 ? (
            <Button className="bq-mt-4" fullWidth size="lg" onClick={next}>
              Next
            </Button>
          ) : (
            <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={submit}>
              {busy ? "Saving…" : kind === "plan" ? "Create & start plan" : "Create & sell package"}
            </Button>
          )}
          <Button className="bq-mt-2" variant="secondary" fullWidth onClick={step === 0 ? onClose : back} disabled={busy}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
        </>
      )}
    </Sheet>
  );
}

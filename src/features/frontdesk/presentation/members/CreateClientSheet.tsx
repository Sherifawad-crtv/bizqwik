import { useMountedThroughExit } from "../../../../shared/hooks/useLatch";
import { useEffect, useState } from "react";
import { useSheetSuccess } from "../../../../design-system/components/useSheetSuccess";
import type { SalePartner } from "../../../../shared/api/backend";
import { useCreateClient } from "../hooks/useMembers";
import { fmt } from "../../../../shared/format";
import type { BundleType, ClassSeries, GroupPlanType } from "../../../../shared/types";
import type { CoachOption } from "../../domain/types";
import { useCurrentLocation, useLocations } from "../../../../shared/session/locations";
import { Button } from "../../../../design-system/components/Button";
import { Sheet } from "../../../../design-system/components/Sheet";
import { Segmented } from "../../../../design-system/components/Segmented";
import { SheetSuccessIcon } from "../../../../design-system/components/SheetSuccessIcon";
import { TextField, SelectField } from "../../../../design-system/components/FormField";
import { PaymentCards } from "../../../../shared/components/PaymentCards";
import type { PayMethod } from "../../../../shared/types";
import { useAuth } from "../../../../shared/session/auth";
import { SheetHeading } from "../../../../design-system/components/SheetHeading";
import { ErrorBanner } from "../../../../design-system/components/ErrorBanner";
import { Card } from "../../../../design-system/components/Card";
import { bundleOptions, coachOptions } from "./offers";
import { NEW_CLIENT_STEPS as CREATE_STEPS, chosenOffer, isSoloOwner, newClientProblem, normalEmail, sharedTypeOf, type PlanKind } from "../../domain/members";
import { GroupOfferSelect, PartnerPicker } from "./partners";
import "./CreateClientSheet.css";

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
  const createLocations = useLocations();
  const { current: createCurrent } = useCurrentLocation();
  const createHere = createLocations.length > 1 ? (createCurrent?.id ?? null) : null;
  // A solo owner is the trainer on every PT package she sells.
  const soloTrainer = isSoloOwner(profile?.role, orgMode) ? (coaches[0]?.id ?? "") : "";
  useEffect(() => {
    if (soloTrainer && coachId !== soloTrainer) setCoachId(soloTrainer);
  }, [soloTrainer, coachId]);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);
  const { busy, error, setError, created, reset, submit: create } = useCreateClient(showSuccess);

  useEffect(() => {
    if (open) {
      setStep(0);
      reset();
      setPartners([]);
      setKind("plan");
      setName("");
      setPhone("");
      setEmail("");
      setOffer("");
      setBundleTypeId("");
      setCoachId("");
      setPayMethod("cash");
    }
  }, [open, reset]);

  if (!mounted) return null;

  const mail = normalEmail(email);
  const sharedType = kind === "plan" ? sharedTypeOf(offer, planTypes) : null;
  const form = { name, phone, email, kind, offer, bundleTypeId, coachId };
  const problem = (s: number) => newClientProblem(s, form, { sharedType, partners: partners.length, created, takenEmails });

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

  const submit = () => create(form, { sharedType, partners, payMethod, here: createHere, takenEmails });

  const chosen = chosenOffer(form, planTypes, series, bundleTypes);
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

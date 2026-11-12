import { useMountedThroughExit } from "../../../lib/useLatch";
import { useEffect, useState } from "react";
import { useSheetSuccess } from "../../../lib/useSheetSuccess";
import { api, type SalePartner } from "../../../lib/backend";
import { fmt } from "../../../lib/format";
import type { BundleType, ClassSeries, CoachOption, GroupPlanType } from "../../../lib/types";
import { useCurrentLocation, useLocations } from "../../../lib/locations";
import { Button } from "../../../components/Button";
import { Sheet } from "../../../components/Sheet";
import { Segmented } from "../../../components/Segmented";
import { SheetSuccessIcon } from "../../../components/SheetSuccessIcon";
import { TextField, SelectField } from "../../../components/FormField";
import { PaymentCards } from "../../../components/PaymentCards";
import type { PayMethod } from "../../../lib/types";
import { useAuth } from "../../../lib/auth";
import { Card, ErrorBanner, SheetHeading } from "../shared";
import { type PlanKind, bundleOptions, coachOptions, offerOf } from "./offers";
import { GroupOfferSelect, PartnerPicker } from "./partners";

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
        const res = kind === "plan" ? await api.sellGroupPlan(fields, offerOf(offer), payMethod, sharedType ? partners : undefined) : await api.createServiceClient(fields, bundleTypeId, coachId, payMethod);
        clientId = res.client.id;
        setCreatedId(clientId);
        const shared = "sharedWith" in res ? res.sharedWith : undefined;
        invites = partners.flatMap((p, i) => ("email" in p && shared?.[i] ? [{ id: shared[i].id, email: p.email }] : []));
        setPendingInvites(invites);
        // A new client belongs to the location she's working at.
        if (createHere) await api.setClientLocation(clientId, createHere).catch(() => undefined);
      }
      // Register the app invite so the client can sign up with this email.
      try {
        await api.inviteClient(clientId, mail);
      } catch (err) {
        setError(`Client created, but the app invite failed: ${err instanceof Error ? err.message : "try again"}. Submitting again only re-sends the invite.`);
        return;
      }
      // The shared bundle's new partners need theirs too.
      for (const inv of invites) {
        try {
          await api.inviteClient(inv.id, inv.email);
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
          <div aria-hidden style={{ display: "flex", gap: 6, margin: "-6px 0 18px" }}>
            {CREATE_STEPS.map((s, i) => (
              <span key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= step ? "var(--primary)" : "var(--line)" }} />
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
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
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
              <div style={{ marginTop: 10, font: "400 var(--fs-small)/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>A new client has no wallet yet, so it's cash or card.</div>
            </>
          )}

          {step === 3 && (
            <>
              <Card style={{ overflow: "hidden" }}>
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
                  <div key={k} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ flex: "none", width: 84, font: "700 var(--fs-caption) var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", paddingTop: 3 }}>{k}</span>
                    <span style={{ minWidth: 0, flex: 1, font: "600 var(--fs-body)/1.4 var(--font-body)", overflowWrap: "anywhere" }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "14px 16px", background: "var(--sunken)" }}>
                  <span style={{ flex: 1, font: "700 var(--fs-caption) var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>TOTAL TO COLLECT</span>
                  <span className="tabular" style={{ font: "800 22px var(--font-body)", letterSpacing: "-.02em" }}>{chosen ? `${fmt(chosen.price)} EGP` : "—"}</span>
                </div>
              </Card>
              <div style={{ marginTop: 10, font: "400 var(--fs-small)/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>Creating the client also sends the app invite to {mail}.</div>
            </>
          )}

          {error && <ErrorBanner text={error} />}
          {step < 3 ? (
            <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={next}>
              Next
            </Button>
          ) : (
            <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={submit}>
              {busy ? "Saving…" : kind === "plan" ? "Create & start plan" : "Create & sell package"}
            </Button>
          )}
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={step === 0 ? onClose : back} disabled={busy}>
            {step === 0 ? "Cancel" : "Back"}
          </Button>
        </>
      )}
    </Sheet>
  );
}

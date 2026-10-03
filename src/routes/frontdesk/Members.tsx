import { EmptyState } from "../../components/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { useLatch } from "../../lib/useLatch";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { api } from "../../lib/backend";
import { fmt, dateLabel } from "../../lib/format";
import type { BundleType, ClassSeries, ClientWithPackage, CoachOption, GroupPlanType, Location } from "../../lib/types";
import { LocationField, locationName, useLocations } from "../../lib/locations";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { Segmented } from "../../components/Segmented";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { TextField, SelectField } from "../../components/FormField";
import { PaymentSelect } from "../../components/PaymentSelect";
import { PaymentCards } from "../../components/PaymentCards";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import type { PayMethod } from "../../lib/types";
import { useSticky } from "../../lib/useSticky";
import { useAuth } from "../../lib/auth";
import { Card, ErrorBanner, PlanPill, SearchField, SheetHeading, endingSoon, matchesClient, planSummary, renewalMessage, whatsappUrl } from "./shared";
import { ConfirmCheckInSheet } from "./CheckIn";
import { DropIn } from "./DropIn";

export function useFrontDeskCatalog() {
  const { data: p } = useAsync(() => api.planTypes(), []);
  const { data: s } = useAsync(() => api.classSeries(), []);
  const { data: b } = useAsync(() => api.bundleTypes(), []);
  return {
    planTypes: p?.planTypes ?? [],
    series: (s?.series ?? []).filter((x) => x.status === "active"),
    bundleTypes: b?.bundleTypes ?? [],
  };
}

/** Everything the desk can sell as a group plan: catalog memberships and
 * bundles, plus each running class's monthly. Values are "pt:<id>" (plan
 * type) or "cs:<id>" (class series). */
function groupOfferOptions(planTypes: GroupPlanType[], series: ClassSeries[], locations: Location[] = []) {
  const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;
  const at = (id: string | null | undefined) => (locationName(locations, id) ? ` · ${locationName(locations, id)}` : "");
  return [
    ...planTypes.map((t) => ({
      value: `pt:${t.id}`,
      label:
        t.kind === "bundle"
          ? `${t.name} · ${fmt(t.price)} EGP · ${t.credits} classes · ${months(t.durationMonths)}${at(t.locationId)}`
          : `${t.name} · ${fmt(t.price)} EGP · all classes · ${months(t.durationMonths)}${at(t.locationId)}`,
    })),
    ...series.map((x) => ({ value: `cs:${x.id}`, label: `${x.title} monthly · ${fmt(x.monthlyPrice)} EGP · 1 month${at(x.locationId)}` })),
  ];
}

/** Who can be picked as the trainer on a PT sale. A solo owner trains her own
 * clients, so it's just her. */
export function useSellableCoaches(): CoachOption[] {
  const { profile, orgMode } = useAuth();
  const solo = profile?.role === "dept_head" && orgMode === "solo";
  const { data } = useAsync(() => (solo ? Promise.resolve({ coaches: [] as CoachOption[] }) : api.coaches()), [solo]);
  if (solo && profile) return [{ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl ?? null } as CoachOption];
  return data?.coaches ?? [];
}
function offerOf(v: string): { planTypeId: string } | { seriesId: string } {
  return v.startsWith("cs:") ? { seriesId: v.slice(3) } : { planTypeId: v.slice(3) };
}

export function Members() {
  useSetHeader({ kicker: "FRONT DESK", title: "Clients" }, []);
  const [params, setParams] = useSearchParams();
  const createRequested = params.get("new") === "1";
  const { data } = useAsync(() => api.clients(), []);
  const { planTypes, series, bundleTypes } = useFrontDeskCatalog();
  const coaches = useSellableCoaches();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useSticky<"all" | "active" | "soon" | "expired" | "none">("memberFilter", "all", { valid: (v) => ["all", "active", "soon", "expired", "none"].includes(v) });
  const [creating, setCreating] = useState(false);
  const [checkInFor, setCheckInFor] = useState<ClientWithPackage | null>(null);
  const [dropInFor, setDropInFor] = useState<{ id: string; name: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The home screen's "New client" quick action lands on ?new=1. It's read
  // from the URL (not router state) because the tab slide remounts this
  // screen when it finishes, and opening waits for that slide to end.
  useEffect(() => {
    if (!createRequested) return;
    const t = window.setTimeout(() => setCreating(true), 360);
    return () => window.clearTimeout(t);
  }, [createRequested]);
  const closeCreate = () => {
    setCreating(false);
    if (createRequested) setParams({}, { replace: true });
  };

  const clients = data?.clients ?? [];
  const shown = useMemo(() => clients.filter((c) => matchesClient(c, query) && (filter === "all" || (filter === "soon" ? endingSoon(c) !== null : planSummary(c, bundleTypes).tone === filter))), [clients, query, filter, bundleTypes]);
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  if (!data) return <Spinner />;

  return (
    <div>
      <SearchField value={query} onChange={setQuery} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 4px", overflowX: "auto" }}>
        {(["all", "active", "soon", "expired", "none"] as const).map((f) => {
          const n = f === "all" ? clients.length : f === "soon" ? clients.filter((c) => endingSoon(c) !== null).length : clients.filter((c) => planSummary(c, bundleTypes).tone === f).length;
          const on = filter === f;
          return (
            <button
              key={f}
              data-tap
              onClick={() => setFilter(f)}
              style={{ flex: "none", height: 36, padding: "0 14px", borderRadius: 999, border: on ? 0 : "1px solid var(--line)", background: on ? "var(--primary)" : "var(--surface)", color: on ? "var(--surface)" : "var(--ink)", font: "700 13px var(--font-body)", cursor: "pointer" }}
            >
              {{ all: "All", active: "Active", soon: "Ending soon", expired: "Expired", none: "No plan" }[f]} · {n}
            </button>
          );
        })}
        <Button size="md" style={{ height: 36, padding: "0 14px", marginLeft: "auto", flex: "none" }} onClick={() => setCreating(true)}>
          + New client
        </Button>
      </div>

      <Card style={{ marginTop: 10, overflow: "hidden" }}>
        {shown.map((c, i) => {
          const plan = planSummary(c, bundleTypes);
          const soon = endingSoon(c);
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 64, padding: "12px 18px", border: 0, borderBottom: i === shown.length - 1 ? "none" : "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {plan.title} · {plan.detail}
                  {soon && <span style={{ color: "var(--logging-fg)", fontWeight: 700 }}> · {soon.label}</span>}
                </div>
              </div>
              <PlanPill tone={plan.tone} />
              <Icon name="chevron-right" size={16} />
            </button>
          );
        })}
        {shown.length === 0 && (
          clients.length === 0 ? (
            <EmptyState bare icon="clients" title="No clients yet" body="Register your first client with + New client. You'll sell them a plan or PT package in the same step, and they get an app invite." />
          ) : (
            <EmptyState bare icon="search" title="No one matches that search" body="Check the spelling, or search by phone number instead." />
          )
        )}
      </Card>

      <CreateClientSheet open={creating} onClose={closeCreate} takenEmails={clients.map((c) => c.email ?? "")} planTypes={planTypes} series={series} bundleTypes={bundleTypes} coaches={coaches} />
      <ConfirmCheckInSheet
        client={checkInFor}
        onClose={() => setCheckInFor(null)}
        onDropIn={(c) => {
          setCheckInFor(null);
          setDropInFor({ id: c.id, name: c.name });
        }}
      />
      <Sheet open={!!dropInFor} onClose={() => setDropInFor(null)}>
        <SheetHeading kicker="FRONT DESK" title="Drop-In" />
        <DropIn embedded initialClient={dropInFor} />
      </Sheet>
      <ClientSheet client={selected} onCheckIn={(c) => { setSelectedId(null); setCheckInFor(c); }} onClose={() => setSelectedId(null)} planTypes={planTypes} series={series} bundleTypes={bundleTypes} coaches={coaches} />
    </div>
  );
}

type PlanKind = "plan" | "service";

const bundleOptions = (types: BundleType[], locations: Location[] = []) =>
  types.map((b) => ({ value: b.id, label: `${b.name} · ${fmt(b.price)} EGP · ${b.sessionsIncluded} sessions${locationName(locations, b.locationId) ? ` · ${locationName(locations, b.locationId)}` : ""}` }));
const coachOptions = (coaches: CoachOption[]) => coaches.map((c) => ({ value: c.id, label: c.name }));

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createLocations = useLocations();
  // A solo owner is the trainer on every PT package she sells.
  const soloTrainer = profile?.role === "dept_head" && orgMode === "solo" ? (coaches[0]?.id ?? "") : "";
  useEffect(() => {
    if (soloTrainer && coachId !== soloTrainer) setCoachId(soloTrainer);
  }, [soloTrainer, coachId]);
  // Set once the client exists, so a retry after a failed invite only re-sends the invite.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (open) {
      setStep(0);
      setCreatedId(null);
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

  if (!open) return null;

  const mail = email.trim().toLowerCase();

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
      if (!clientId) {
        const { client } = kind === "plan" ? await api.sellGroupPlan(fields, offerOf(offer), payMethod) : await api.createServiceClient(fields, bundleTypeId, coachId, payMethod);
        clientId = client.id;
        setCreatedId(clientId);
      }
      // Register the app invite so the client can sign up with this email.
      try {
        await api.inviteClient(clientId, mail);
      } catch (err) {
        setError(`Client created, but the app invite failed: ${err instanceof Error ? err.message : "try again"}. Submitting again only re-sends the invite.`);
        return;
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
      return { title: t.name, detail: t.kind === "bundle" ? `${t.credits} classes · ${months}` : `All classes · ${months}`, price: t.price };
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
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {kind === "plan" ? (
                  <GroupOfferSelect value={offer} onChange={setOffer} planTypes={planTypes} series={series} />
                ) : (
                  <>
                    <SelectField label="PACKAGE" value={bundleTypeId} onChange={setBundleTypeId} placeholder="Choose a package" options={bundleOptions(bundleTypes, createLocations)} empty={{ title: "No PT packages yet", body: soloTrainer ? "Add PT bundles in Plans → PT bundles. Once one exists you can sell it here." : "The department head adds PT packages in Catalog → PT bundles. Once one exists you can sell it here." }} />
                    {!soloTrainer && <SelectField label="COACH" value={coachId} onChange={setCoachId} placeholder="Choose a coach" options={coachOptions(coaches)} empty={{ title: "No coaches yet", body: "The department head invites coaches from Team → Team & tiers. They appear here once they sign up." }} />}
                  </>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <PaymentCards value={payMethod} onChange={setPayMethod} />
              <div style={{ marginTop: 10, font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>A new client has no wallet yet, so it's cash or card.</div>
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
                    ...(kind === "service" ? [["COACH", coachName ?? "—"]] : []),
                    ["PAYMENT", payMethod.toUpperCase()],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ flex: "none", width: 84, font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", paddingTop: 3 }}>{k}</span>
                    <span style={{ minWidth: 0, flex: 1, font: "600 15px/1.4 var(--font-body)", overflowWrap: "anywhere" }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "14px 16px", background: "var(--sunken)" }}>
                  <span style={{ flex: 1, font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>TOTAL TO COLLECT</span>
                  <span className="tabular" style={{ font: "800 22px var(--font-body)", letterSpacing: "-.02em" }}>{chosen ? `${fmt(chosen.price)} EGP` : "—"}</span>
                </div>
              </Card>
              <div style={{ marginTop: 10, font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>Creating the client also sends the app invite to {mail}.</div>
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

type Mode = "view" | "sell-plan" | "renew-package" | "assign" | "invite" | "refund" | "pt-log" | "location";

function ClientSheet({
  client,
  onClose,
  planTypes,
  series,
  bundleTypes,
  coaches,
  onCheckIn,
}: {
  client: ClientWithPackage | null;
  onClose: () => void;
  onCheckIn: (c: ClientWithPackage) => void;
  planTypes: GroupPlanType[];
  series: ClassSeries[];
  bundleTypes: BundleType[];
  coaches: CoachOption[];
}) {
  const shown = useLatch(client);
  const { profile: me, orgMode: om } = useAuth();
  const solo = me?.role === "dept_head" && om === "solo";
  const sheetLocations = useLocations();
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
  const [busy, setBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = !!client;
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (client) {
      setMode("view");
      setShowMore(false);
      setPickId("");
      setCoachId(client.assignedCoachId ?? "");
      setEmail(client.email ?? "");
      setRefundAmount("");
      setRefundDest("wallet");
      setRefundNote("");
      setRefundable(null);
      setPayMethod("cash");
      setLocPick(client.homeLocationId ?? null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  useEffect(() => {
    if (mode !== "refund" || !client) return;
    let alive = true;
    api.refundable(client.id).then((r) => alive && setRefundable(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [mode, client?.id]);

  if (!shown) return null;

  const plan = shown.groupPlan ?? null;
  const pkg = shown.currentPackage;
  const packageActive = pkg?.status === "active";
  const bType = pkg ? bundleTypes.find((b) => b.id === pkg.bundleTypeId) : undefined;
  const summary = planSummary(shown, bundleTypes);
  const coachName = coaches.find((c) => c.id === shown.assignedCoachId)?.name ?? null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
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
      return run(() => api.sellGroupPlan({ clientId: shown.id }, offerOf(pickId), payMethod));
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
            {shown.phone && <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: -8, marginBottom: 14 }}>{shown.phone}</div>}

            <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ font: "800 18px var(--font-body)", flex: 1, minWidth: 0 }}>{summary.title}</div>
                <PlanPill tone={summary.tone} />
              </div>
              <div style={{ font: "400 14px var(--font-mono)", color: "var(--ink-muted)", marginTop: 4 }}>{summary.detail}</div>
              {plan && plan.kind === "bundle" && <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>Until {dateLabel(plan.expiresAt.slice(0, 10))}</div>}
              {packageActive && plan && (
                <div style={{ font: "600 13px var(--font-body)", color: "var(--ink)", marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--line)" }}>
                  + {bType?.name ?? "Package"}: {pkg!.sessionsRemaining} of {pkg!.sessionsIncluded} sessions left
                </div>
              )}
              {coachName && !solo && <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 6 }}>Coach: {coachName}</div>}
              {sheetLocations.length > 0 && (
                <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 6 }}>Location: {locationName(sheetLocations, shown.homeLocationId) ?? "Not set"}</div>
              )}
            </div>
            {solo && packageActive && pkg && me && pkg.coachId === me.id && (
              <Button
                variant="secondary"
                fullWidth
                style={{ marginTop: 12 }}
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
              <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={() => onCheckIn(shown)}>
                Check in
              </Button>
            ) : (
              <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={() => setMode(plan ? "renew-package" : "sell-plan")}>
                Sell a plan
              </Button>
            )}

            {(summary.tone !== "active" || endingSoon(shown) !== null) && whatsappUrl(shown.phone, "") && (
              <Button
                variant="secondary"
                fullWidth
                style={{ marginTop: 8 }}
                onClick={() => window.open(whatsappUrl(shown.phone, renewalMessage(shown, bundleTypes))!, "_blank", "noopener")}
              >
                {summary.tone === "active" ? "Remind to renew on WhatsApp" : "Message on WhatsApp"}
              </Button>
            )}

            <button
              data-tap
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, width: "100%", height: 48, marginTop: 6, border: 0, background: "none", color: "var(--primary-pressed)", font: "700 14px var(--font-body)", cursor: "pointer" }}
            >
              {showMore ? "Fewer options" : "More options"}
            </button>
            {showMore && (
              <div style={{ border: "1px solid var(--line)", borderRadius: "var(--r-input)", overflow: "hidden" }}>
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
                      data-tap
                      onClick={x.go}
                      style={{ display: "flex", alignItems: "center", width: "100%", minHeight: 52, padding: "0 16px", border: 0, borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left", font: "600 15px var(--font-body)", color: x.danger ? "var(--danger-fg)" : "var(--ink)" }}
                    >
                      <span style={{ flex: 1 }}>{x.label}</span>
                      <Icon name="chevron-right" size={16} />
                    </button>
                  ))}
              </div>
            )}
          </>
        ) : (
          <>
            <SheetHeading
              kicker={shown.name.toUpperCase()}
              title={mode === "assign" ? "Assign a coach" : mode === "invite" ? "Invite to app" : mode === "refund" ? "Issue a refund" : mode === "sell-plan" ? "Choose a plan" : "Choose package"}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mode === "refund" && (
                <>
                  <TextField label="AMOUNT (EGP)" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} inputMode="decimal" placeholder="0" />
                  {refundable && (
                    <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
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
                  <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
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
                  <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
                    They'll use this email to sign in to the branded member app.
                  </div>
                </>
              )}
              {mode === "location" && <LocationField locations={sheetLocations} value={locPick} onChange={setLocPick} />}
              {mode === "sell-plan" && <GroupOfferSelect value={pickId} onChange={setPickId} planTypes={planTypes} series={series} />}
              {mode === "renew-package" && <SelectField label="PACKAGE" value={pickId} onChange={setPickId} placeholder="Choose a package" options={bundleOptions(bundleTypes, sheetLocations)} empty={{ title: "No PT packages yet", body: solo ? "Add PT bundles in Plans → PT bundles. Once one exists you can sell it here." : "The department head adds PT packages in Catalog → PT bundles. Once one exists you can sell it here." }} />}
              {((mode === "renew-package" && !solo) || mode === "assign") && (
                <SelectField label="COACH" value={coachId} onChange={setCoachId} placeholder="Choose a coach" options={coachOptions(coaches)} empty={{ title: "No coaches yet", body: "The department head invites coaches from Team → Team & tiers. They appear here once they sign up." }} />
              )}
              {(mode === "sell-plan" || mode === "renew-package") && (
                <PaymentSelect value={payMethod} onChange={setPayMethod} wallet />
              )}
            </div>
            {error && <ErrorBanner text={error} />}
            <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={confirmMode}>
              {busy ? "Saving…" : mode === "assign" ? "Assign coach" : mode === "invite" ? "Send invitation" : mode === "refund" ? "Issue refund" : mode === "sell-plan" ? "Start plan" : mode === "location" ? "Save location" : "Sell package"}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              style={{ marginTop: 8 }}
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

function GroupOfferSelect({ value, onChange, planTypes, series }: { value: string; onChange: (v: string) => void; planTypes: GroupPlanType[]; series: ClassSeries[] }) {
  const options = groupOfferOptions(planTypes, series, useLocations());
  const { profile, orgMode } = useAuth();
  // A solo owner with a couple of plans picks them as cards, not from a list.
  if (profile?.role === "dept_head" && orgMode === "solo" && options.length > 0 && options.length <= 6) {
    return (
      <div role="radiogroup" aria-label="Plan" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {options.map((o) => {
          const [name, price, ...rest] = o.label.split(" · ");
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              data-sq
              data-tap
              onClick={() => onChange(o.value)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", cursor: "pointer", textAlign: "left", borderRadius: "var(--r-card)", border: on ? "2px solid var(--primary)" : "1px solid var(--line)", background: on ? "var(--primary-tint)" : "var(--surface)", color: "var(--ink)" }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", font: "800 18px var(--font-body)", letterSpacing: "-.01em" }}>{name}</span>
                <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>{rest.join(" · ")}</span>
              </span>
              <span style={{ font: "800 18px var(--font-mono)", color: on ? "var(--primary-pressed)" : "var(--ink)" }}>{price}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <>
      <SelectField
        label="GROUP PLAN"
        value={value}
        onChange={onChange}
        placeholder="Membership, class monthly or bundle"
        options={options}
        empty={{ title: "Nothing on sale yet", body: "The department head adds classes, memberships and class bundles in Catalog. They show up here to sell as soon as they're created." }}
      />
    </>
  );
}

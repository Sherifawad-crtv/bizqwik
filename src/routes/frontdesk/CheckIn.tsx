import { useCurrentLocation } from "../../lib/locations";
import { useEffect, useState } from "react";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { useLatch } from "../../lib/useLatch";
import { api, ApiError } from "../../lib/backend";
import type { ClientWithPackage } from "../../lib/types";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { Spinner } from "../../components/Spinner";
import { ClientPicker, ErrorBanner, PlanPill, planSummary } from "./shared";
import { ClientSheet, useFrontDeskCatalog, useSellableCoaches } from "./Members";
import { useNewClient } from "./NewClientModal";
import { DropIn } from "./DropIn";
import { SheetHeading } from "./shared";
import { dateLabel } from "../../lib/format";

const hasActivePlan = (c: ClientWithPackage) => !!c.groupPlan || c.currentPackage?.status === "active";
// A class bundle with nothing left can't be checked in on (unless PT covers them).
const bundleEmpty = (c: ClientWithPackage) => c.groupPlan?.kind === "bundle" && (c.groupPlan.creditsRemaining ?? 0) <= 0;

// Clients normally check themselves in by scanning the desk's QR code in the
// client app; this is the desk's manual fallback.
export function CheckIn({ embedded = false, onDropIn, onCreateClient }: { embedded?: boolean; onDropIn?: (c: ClientWithPackage) => void; onCreateClient?: () => void } = {}) {
  useSetHeader(embedded ? null : { kicker: "FRONT DESK", title: "Check-In" }, []);
  const newClient = useNewClient();
  // Reached on its own, a check-in that needs a drop-in opens it right here.
  const [dropInFor, setDropInFor] = useState<{ id: string; name: string } | null>(null);
  const { data } = useAsync(() => api.clients(), []);
  const { bundleTypes } = useFrontDeskCatalog();
  const [picked, setPicked] = useState<ClientWithPackage | null>(null);

  if (!data) return <Spinner />;

  return (
    <div>
      <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)", margin: "0 2px 14px" }}>
        Find the client by name or phone to check them in by hand.
      </div>
      <ClientPicker clients={data.clients} bundleTypes={bundleTypes} onPick={setPicked} onCreate={onCreateClient ?? newClient.open} />
      <ConfirmCheckInSheet
        client={picked}
        onClose={() => setPicked(null)}
        onDropIn={(c) => (onDropIn ? onDropIn(c) : setDropInFor({ id: c.id, name: c.name }))}
      />
      <Sheet open={!!dropInFor} onClose={() => setDropInFor(null)}>
        <SheetHeading kicker="FRONT DESK" title="Drop-In" />
        <DropIn embedded initialClient={dropInFor} />
      </Sheet>
      {newClient.modal}
    </div>
  );
}

export function ConfirmCheckInSheet({ client, onClose, onDropIn }: { client: ClientWithPackage | null; onClose: () => void; onDropIn: (c: ClientWithPackage) => void }) {
  // Where this check-in happens (businesses with locations).
  const { current: here } = useCurrentLocation();
  const shown = useLatch(client);
  const open = !!client;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noSessions, setNoSessions] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState("");
  const { planTypes, series, bundleTypes } = useFrontDeskCatalog();
  const coaches = useSellableCoaches();
  // Selling from here (renew / new plan / PT) opens the same sheet as the client's page; the
  // check-in sheet steps aside and comes back, with their new plan, when it closes.
  const [sell, setSell] = useState<"sell-plan" | "renew-package" | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const live = useAsync(() => api.clients(), []);
  const fresh = (client && live.data?.clients.find((c) => c.id === client.id)) || null;
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open && !sell, onClose);
  const startSell = (mode: "sell-plan" | "renew-package") => {
    setSell(mode);
    window.setTimeout(() => setSellOpen(true), 260);
  };
  const endSell = () => {
    setNoSessions(null);
    setSellOpen(false);
    window.setTimeout(() => setSell(null), 260);
  };

  useEffect(() => {
    if (!client) return;
    setError(null);
    setNoSessions(null);
    // A bundle that ran out is no longer "active", so look at their latest
    // plan to say exactly why they can't check in.
    if (hasActivePlan(client)) return;
    let alive = true;
    api.clientPlans(client.id).then((r) => {
      const last = r.plans[0];
      if (alive && last && last.kind === "bundle" && (last.creditsRemaining ?? 0) <= 0 && Date.parse(last.expiresAt) > Date.now()) {
        setNoSessions(`${client.name} has used all ${last.creditsTotal} sessions of ${last.name}.`);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [client]);

  if (!shown) return null;
  const current = fresh ?? shown;
  const plan = planSummary(current, bundleTypes);
  const bundle = current.groupPlan?.kind === "bundle" ? current.groupPlan : null;
  const empty = bundleEmpty(current) && current.currentPackage?.status !== "active";
  // A frozen plan can't be checked in on until it restarts (a PT package still can).
  const frozenUntil = current.groupPlan?.frozenUntil && Date.parse(current.groupPlan.frozenUntil) > Date.now() && current.currentPackage?.status !== "active" ? current.groupPlan.frozenUntil : null;
  const eligible = hasActivePlan(current) && !empty && !noSessions && !frozenUntil;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.checkIn(shown.id, "manual", here?.id);
      const p = res.plan;
      setDoneLabel(res.deducted && p ? `${shown.name} checked in · ${p.creditsRemaining} of ${p.creditsTotal} sessions left` : `${shown.name} checked in`);
      showSuccess();
    } catch (err) {
      if (err instanceof ApiError && err.code === "no_sessions") setNoSessions(err.message);
      else setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <Sheet open={open && !sell} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={doneLabel || `${shown.name} checked in`} iconIn={iconIn} />
      ) : (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>CHECK-IN</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{shown.name}</div>
          <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", flex: 1 }}>CURRENT PLAN</div>
              <PlanPill client={current} />
            </div>
            <div style={{ font: "700 16px var(--font-body)", marginTop: 4 }}>{plan.title}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>{plan.detail}</div>
          </div>
          {error && <ErrorBanner text={error} />}
          {bundle && eligible && (
            <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--ink)", background: "var(--primary-tint)", borderRadius: 14, padding: "10px 14px" }}>
              Checking in uses 1 session of {bundle.name} ({bundle.creditsRemaining} → {Math.max(0, (bundle.creditsRemaining ?? 0) - 1)} left). Every visit counts, even twice in a day.
            </div>
          )}
          {(empty || noSessions) && (
            <div role="alert" data-testid="no-sessions" style={{ marginTop: 12, background: "var(--danger-bg)", color: "var(--danger-fg)", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ font: "800 15px var(--font-body)" }}>No sessions left</div>
              <div style={{ font: "600 13px/1.5 var(--font-body)", marginTop: 2 }}>
                {noSessions ?? `${shown.name} has used all ${bundle?.creditsTotal ?? ""} sessions of ${bundle?.name ?? "their bundle"}.`} Renew their plan below, or sell a drop-in for today.
              </div>
            </div>
          )}
          {eligible ? (
            <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={confirm}>
              {busy ? "Checking in…" : "Confirm check-in"}
            </Button>
          ) : (
            <>
              <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--logging-fg)", background: "var(--logging-bg)", borderRadius: 14, padding: "10px 14px" }}>
                {frozenUntil
                  ? `Their plan is frozen until ${dateLabel(frozenUntil.slice(0, 10))} and restarts by itself. Until then they can pay for a drop-in.`
                  : empty || noSessions ? "Nothing to check in on today." : "No active plan or package — they can renew a plan below, or pay for a drop-in."}
              </div>
              {/* Whoever can't check in can be sold what they need, right here. A frozen plan is still theirs. */}
              {!frozenUntil && (
                <Button fullWidth size="lg" style={{ marginTop: 16 }} data-testid="renew-plan" onClick={() => startSell("sell-plan")}>
                  {current.lastGroupPlan || current.currentPackage ? "Renew plan" : "Sell a plan"}
                </Button>
              )}
              {!frozenUntil && current.currentPackage?.status !== "active" && bundleTypes.length > 0 && (
                <Button variant="secondary" fullWidth style={{ marginTop: 8 }} data-testid="sell-pt" onClick={() => startSell("renew-package")}>
                  {current.currentPackage ? "Renew PT package" : "Sell a PT package"}
                </Button>
              )}
              <Button variant={frozenUntil ? "primary" : "secondary"} fullWidth size={frozenUntil ? "lg" : "md"} style={{ marginTop: frozenUntil ? 16 : 8 }} onClick={() => onDropIn(shown)}>
                Sell a drop-in pass
              </Button>
            </>
          )}
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
    <ClientSheet
      client={sellOpen ? current : null}
      startIn={sell ?? undefined}
      onClose={endSell}
      onCheckIn={endSell}
      planTypes={planTypes}
      series={series}
      bundleTypes={bundleTypes}
      coaches={coaches}
    />
    </>
  );
}

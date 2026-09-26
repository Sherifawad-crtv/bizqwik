import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { useFrontDeskCatalog } from "./Members";

const hasActivePlan = (c: ClientWithPackage) => !!c.groupPlan || c.currentPackage?.status === "active";
// A class bundle with nothing left can't be checked in on (unless PT covers them).
const bundleEmpty = (c: ClientWithPackage) => c.groupPlan?.kind === "bundle" && (c.groupPlan.creditsRemaining ?? 0) <= 0;

// Clients normally check themselves in by scanning the desk's QR code in the
// client app; this is the desk's manual fallback.
export function CheckIn() {
  useSetHeader({ kicker: "FRONT DESK", title: "Check-In" }, []);
  const navigate = useNavigate();
  const { data } = useAsync(() => api.clients(), []);
  const { bundleTypes } = useFrontDeskCatalog();
  const [picked, setPicked] = useState<ClientWithPackage | null>(null);

  if (!data) return <Spinner />;

  return (
    <div>
      <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)", margin: "0 2px 14px" }}>
        Find the client by name or phone to check them in by hand.
      </div>
      <ClientPicker clients={data.clients} bundleTypes={bundleTypes} onPick={setPicked} />
      <ConfirmCheckInSheet
        client={picked}
        onClose={() => setPicked(null)}
        onDropIn={(c) => navigate(`/drop-in?${new URLSearchParams({ client: c.id, name: c.name })}`)}
      />
    </div>
  );
}

function ConfirmCheckInSheet({ client, onClose, onDropIn }: { client: ClientWithPackage | null; onClose: () => void; onDropIn: (c: ClientWithPackage) => void }) {
  const shown = useLatch(client);
  const open = !!client;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noSessions, setNoSessions] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState("");
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);
  const { bundleTypes } = useFrontDeskCatalog();

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
  const plan = planSummary(shown, bundleTypes);
  const bundle = shown.groupPlan?.kind === "bundle" ? shown.groupPlan : null;
  const empty = bundleEmpty(shown) && shown.currentPackage?.status !== "active";
  const eligible = hasActivePlan(shown) && !empty && !noSessions;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.checkIn(shown.id, "manual");
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
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={doneLabel || `${shown.name} checked in`} iconIn={iconIn} />
      ) : (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>CHECK-IN</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{shown.name}</div>
          <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", flex: 1 }}>CURRENT PLAN</div>
              <PlanPill tone={plan.tone} />
            </div>
            <div style={{ font: "700 16px var(--font-body)", marginTop: 4 }}>{plan.title}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>{plan.detail}</div>
          </div>
          {error && <ErrorBanner text={error} />}
          {bundle && eligible && (
            <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--ink)", background: "var(--primary-tint)", borderRadius: 14, padding: "10px 14px" }}>
              Checking in uses 1 session of {bundle.name} ({bundle.creditsRemaining} → {Math.max(0, (bundle.creditsRemaining ?? 0) - 1)} left). Only the first check-in of the day counts.
            </div>
          )}
          {(empty || noSessions) && (
            <div role="alert" data-testid="no-sessions" style={{ marginTop: 12, background: "var(--danger-bg)", color: "var(--danger-fg)", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ font: "800 15px var(--font-body)" }}>No sessions left</div>
              <div style={{ font: "600 13px/1.5 var(--font-body)", marginTop: 2 }}>
                {noSessions ?? `${shown.name} has used all ${bundle?.creditsTotal ?? ""} sessions of ${bundle?.name ?? "their bundle"}.`} Renew their bundle from their client page, or sell a drop-in for today.
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
                {empty || noSessions ? "Nothing to check in on today." : "No active plan or package — they can pay for a drop-in, or buy a plan from their client page."}
              </div>
              <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={() => onDropIn(shown)}>
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
  );
}

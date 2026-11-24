import { useCurrentLocation } from "../../../shared/session/locations";
import { useState } from "react";
import { useSetHeader } from "../../../shared/screen/header";
import { useSheetSuccess } from "../../../design-system/components/useSheetSuccess";
import { useLatch } from "../../../shared/hooks/useLatch";
import { useDeskClients } from "./hooks/useDesk";
import { useConfirmCheckIn } from "./hooks/useCheckIn";
import { checkInState } from "../domain/checkIn";
import type { ClientWithPackage } from "../../../shared/types";
import { Button } from "../../../design-system/components/Button";
import { Sheet } from "../../../design-system/components/Sheet";
import { SheetSuccessIcon } from "../../../design-system/components/SheetSuccessIcon";
import { Spinner } from "../../../design-system/components/Spinner";
import { ClientPicker } from "./shared";
import { PlanPill } from "../../../shared/components/PlanPill";
import { ErrorBanner } from "../../../design-system/components/ErrorBanner";
import { planSummary } from "../../../shared/domain/deskStatus";
import { ClientSheet } from "./members/ClientSheet";
import { useFrontDeskCatalog, useSellableCoaches } from "./hooks/useMembers";
import { useNewClient } from "./NewClientModal";
import { DropIn } from "./DropIn";
import { SheetHeading } from "../../../design-system/components/SheetHeading";
import { dateLabel } from "../../../shared/format";
import { useNow } from "../../../shared/hooks/useNow";
import "./CheckIn.css";

// Clients normally check themselves in by scanning the desk's QR code in the
// client app; this is the desk's manual fallback.
export function CheckIn({ embedded = false, onDropIn, onCreateClient }: { embedded?: boolean; onDropIn?: (c: ClientWithPackage) => void; onCreateClient?: () => void } = {}) {
  useSetHeader(embedded ? null : { kicker: "FRONT DESK", title: "Check-In" }, []);
  const newClient = useNewClient();
  // Reached on its own, a check-in that needs a drop-in opens it right here.
  const [dropInFor, setDropInFor] = useState<{ id: string; name: string } | null>(null);
  const { data } = useDeskClients();
  const { bundleTypes } = useFrontDeskCatalog();
  const [picked, setPicked] = useState<ClientWithPackage | null>(null);

  if (!data) return <Spinner />;

  return (
    <div>
      <div className="bq-frontdesk-check-in-meta">
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
  const now = useNow();
  const { busy, error, usedUp: noSessions, clearUsedUp, confirm: checkIn } = useConfirmCheckIn(client, here?.id);
  const [doneLabel, setDoneLabel] = useState("");
  const { planTypes, series, bundleTypes } = useFrontDeskCatalog();
  const coaches = useSellableCoaches();
  // Selling from here (renew / new plan / PT) opens the same sheet as the client's page; the
  // check-in sheet steps aside and comes back, with their new plan, when it closes.
  const [sell, setSell] = useState<"sell-plan" | "renew-package" | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const live = useDeskClients();
  const fresh = (client && live.data?.clients.find((c) => c.id === client.id)) || null;
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open && !sell, onClose);
  const startSell = (mode: "sell-plan" | "renew-package") => {
    setSell(mode);
    window.setTimeout(() => setSellOpen(true), 260);
  };
  const endSell = () => {
    clearUsedUp();
    setSellOpen(false);
    window.setTimeout(() => setSell(null), 260);
  };

  if (!shown) return null;
  const current = fresh ?? shown;
  const plan = planSummary(current, bundleTypes);
  const { bundle, empty, frozenUntil, eligible } = checkInState(current, noSessions, now);

  const confirm = async () => {
    const left = await checkIn(shown.id);
    if (left === false) return;
    setDoneLabel(left ? `${shown.name} checked in · ${left.left} of ${left.total} sessions left` : `${shown.name} checked in`);
    showSuccess();
  };

  return (
    <>
    <Sheet open={open && !sell} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={doneLabel || `${shown.name} checked in`} iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">CHECK-IN</div>
          <div className="bq-title">{shown.name}</div>
          <div className="bq-frontdesk-check-in-confirm-check-in-sheet-box">
            <div className="bq-flex bq-items-center bq-gap-2">
              <div className="bq-frontdesk-check-in-confirm-check-in-sheet-label">CURRENT PLAN</div>
              <PlanPill client={current} />
            </div>
            <div className="bq-frontdesk-check-in-confirm-check-in-sheet-title">{plan.title}</div>
            <div className="bq-frontdesk-check-in-confirm-check-in-sheet-meta">{plan.detail}</div>
          </div>
          {error && <ErrorBanner text={error} />}
          {bundle && eligible && (
            <div className="bq-frontdesk-check-in-confirm-check-in-sheet-text">
              Checking in uses 1 session of {bundle.name} ({bundle.creditsRemaining} → {Math.max(0, (bundle.creditsRemaining ?? 0) - 1)} left). Every visit counts, even twice in a day.
            </div>
          )}
          {(empty || noSessions) && (
            <div className="bq-frontdesk-check-in-confirm-check-in-sheet-box-2" role="alert" data-testid="no-sessions">
              <div className="bq-frontdesk-check-in-confirm-check-in-sheet-title-2">No sessions left</div>
              <div className="bq-frontdesk-check-in-confirm-check-in-sheet-text-2">
                {noSessions ?? `${shown.name} has used all ${bundle?.creditsTotal ?? ""} sessions of ${bundle?.name ?? "their bundle"}.`} Renew their plan below, or sell a drop-in for today.
              </div>
            </div>
          )}
          {eligible ? (
            <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={confirm}>
              {busy ? "Checking in…" : "Confirm check-in"}
            </Button>
          ) : (
            <>
              <div className="bq-frontdesk-check-in-confirm-check-in-sheet-text-3">
                {frozenUntil
                  ? `Their plan is frozen until ${dateLabel(frozenUntil.slice(0, 10))} and restarts by itself. Until then they can pay for a drop-in.`
                  : empty || noSessions ? "Nothing to check in on today." : "No active plan or package — they can renew a plan below, or pay for a drop-in."}
              </div>
              {/* Whoever can't check in can be sold what they need, right here. A frozen plan is still theirs. */}
              {!frozenUntil && (
                <Button className="bq-mt-4" fullWidth size="lg" data-testid="renew-plan" onClick={() => startSell("sell-plan")}>
                  {current.lastGroupPlan || current.currentPackage ? "Renew plan" : "Sell a plan"}
                </Button>
              )}
              {!frozenUntil && current.currentPackage?.status !== "active" && bundleTypes.length > 0 && (
                <Button className="bq-mt-2" variant="secondary" fullWidth data-testid="sell-pt" onClick={() => startSell("renew-package")}>
                  {current.currentPackage ? "Renew PT package" : "Sell a PT package"}
                </Button>
              )}
              <Button variant={frozenUntil ? "primary" : "secondary"} fullWidth size={frozenUntil ? "lg" : "md"} style={{ marginTop: frozenUntil ? 16 : 8 }} onClick={() => onDropIn(shown)}>
                Sell a drop-in pass
              </Button>
            </>
          )}
          <Button className="bq-mt-2" variant="secondary" fullWidth onClick={onClose} disabled={busy}>
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

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { useLatch } from "../../lib/useLatch";
import { api } from "../../lib/backend";
import type { ClientWithPackage } from "../../lib/types";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { Spinner } from "../../components/Spinner";
import { ClientPicker, ErrorBanner, PlanPill, planSummary } from "./shared";
import { useFrontDeskCatalog } from "./Members";

const hasActivePlan = (c: ClientWithPackage) => c.currentMembership?.status === "active" || c.currentPackage?.status === "active";

// Clients normally check themselves in by scanning the desk's QR code in the
// client app; this is the desk's manual fallback.
export function CheckIn() {
  useSetHeader({ kicker: "FRONT DESK", title: "Check-In" }, []);
  const navigate = useNavigate();
  const { data } = useAsync(() => api.clients(), []);
  const { membershipTypes, bundleTypes } = useFrontDeskCatalog();
  const [picked, setPicked] = useState<ClientWithPackage | null>(null);

  if (!data) return <Spinner />;

  return (
    <div>
      <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)", margin: "0 2px 14px" }}>
        Find the client by name or phone to check them in by hand.
      </div>
      <ClientPicker clients={data.clients} membershipTypes={membershipTypes} bundleTypes={bundleTypes} onPick={setPicked} />
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
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);
  const { membershipTypes, bundleTypes } = useFrontDeskCatalog();

  useEffect(() => {
    if (client) setError(null);
  }, [client]);

  if (!shown) return null;
  const plan = planSummary(shown, membershipTypes, bundleTypes);
  const eligible = hasActivePlan(shown);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.checkIn(shown.id, "manual");
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={`${shown.name} checked in`} iconIn={iconIn} />
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
          {eligible ? (
            <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={confirm}>
              {busy ? "Checking in…" : "Confirm check-in"}
            </Button>
          ) : (
            <>
              <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--logging-fg)", background: "var(--logging-bg)", borderRadius: 14, padding: "10px 14px" }}>
                No active membership or package — they can pay for a drop-in, or renew from their client page.
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

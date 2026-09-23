import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { useLatch } from "../../lib/useLatch";
import { api } from "../../lib/backend";
import type { ClientWithPackage } from "../../lib/types";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { Icon } from "../../components/Icon";
import { ClientPicker, ErrorBanner, PlanPill, parseMemberCode, planSummary } from "./shared";
import { useFrontDeskCatalog } from "./Members";

const REGION_ID = "bq-qr-region";

type Source = "qr" | "manual";
interface Lookup {
  client: ClientWithPackage;
  eligible: boolean;
  source: Source;
}

function describeCameraError(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (/NotAllowed|Permission/i.test(msg)) return "Camera access was blocked. Allow camera access for this site in your browser settings, then try again.";
  if (/NotFound|Requested device not found/i.test(msg)) return "No camera was found on this device.";
  if (/NotReadable|in use/i.test(msg)) return "The camera is being used by another app. Close it and try again.";
  if (/secure|https/i.test(msg)) return "The camera only works over a secure (https) connection.";
  return "Couldn't start the camera. You can still check people in by name below.";
}

export function CheckIn() {
  useSetHeader({ kicker: "FRONT DESK", title: "Check-In" }, []);
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [cameraState, setCameraState] = useState<"starting" | "scanning" | "error">("starting");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handlingRef = useRef(false);
  // A member usually keeps their code in front of the camera for a moment
  // after checking in; without this the scanner would re-prompt for them.
  const recentRef = useRef<{ id: string; at: number } | null>(null);

  const resume = useCallback(() => {
    handlingRef.current = false;
    try {
      scannerRef.current?.resume();
    } catch {
      // not paused (or never started) — nothing to resume
    }
  }, []);

  const handle = useCallback(
    async (raw: string, source: Source) => {
      if (handlingRef.current) return;
      if (source === "qr") {
        const recent = recentRef.current;
        const scanned = parseMemberCode(raw);
        if (recent && scanned === recent.id && Date.now() - recent.at < 8000) return;
      }
      handlingRef.current = true;
      try {
        scannerRef.current?.pause(true);
      } catch {
        // scanner not running (manual lookup without a camera)
      }
      const id = source === "qr" ? parseMemberCode(raw) : raw;
      if (!id) {
        setFlash("That isn't a Bizqwik member code.");
        window.setTimeout(() => setFlash(null), 2400);
        resume();
        return;
      }
      try {
        const res = await api.clientStatus(id);
        setLookup({ ...res, source });
      } catch (err) {
        setFlash(err instanceof Error ? err.message : "Couldn't look that member up.");
        window.setTimeout(() => setFlash(null), 2400);
        resume();
      }
    },
    [resume],
  );

  const handleRef = useRef(handle);
  handleRef.current = handle;

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;
    setCameraState("starting");
    setCameraError(null);
    // The tab slide remounts this screen when it finishes (~320ms); starting
    // after that means the camera spins up once, not twice.
    const startTimer = window.setTimeout(() => {
      if (cancelled) return;
      const s = new Html5Qrcode(REGION_ID, { verbose: false });
      scanner = s;
      scannerRef.current = s;
      s.start(
        { facingMode: "environment" },
        // Whole-frame scanning: the feed is cropped to fill the square
        // (object-fit: cover below), which would misalign a qrbox.
        { fps: 10 },
        (text) => handleRef.current(text, "qr"),
        () => {
          // a frame with no QR in it — expected constantly while scanning
        },
      )
        .then(() => {
          if (cancelled) s.stop().then(() => s.clear()).catch(() => {});
          else setCameraState("scanning");
        })
        .catch((err) => {
          if (cancelled) return;
          setCameraState("error");
          setCameraError(describeCameraError(err));
        });
    }, 360);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      const s = scanner;
      if (s?.isScanning) s.stop().then(() => s.clear()).catch(() => {});
      if (s && scannerRef.current === s) scannerRef.current = null;
    };
  }, [attempt]);

  const closeLookup = () => {
    if (lookup) recentRef.current = { id: lookup.client.id, at: Date.now() };
    setLookup(null);
    resume();
  };

  return (
    <div>
      <div
        data-sq
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 360,
          aspectRatio: "1 / 1",
          margin: "0 auto",
          borderRadius: "var(--r-card)",
          overflow: "hidden",
          background: "var(--ink)",
          border: cameraState === "scanning" ? "3px solid var(--primary)" : "1px solid var(--line)",
        }}
      >
        <style>{`#${REGION_ID} video { width: 100% !important; height: 100% !important; object-fit: cover; }`}</style>
        <div id={REGION_ID} style={{ width: "100%", height: "100%" }} />
        {cameraState === "scanning" && (
          <div aria-hidden style={{ position: "absolute", inset: "16%", border: "2px solid rgba(255,255,255,.85)", borderRadius: 18, pointerEvents: "none" }} />
        )}
        {cameraState !== "scanning" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 24,
              textAlign: "center",
              background: "var(--sunken)",
              color: "var(--ink-muted)",
            }}
          >
            <Icon name="qr" size={44} />
            <div style={{ font: "600 14px/1.5 var(--font-body)" }}>{cameraState === "starting" ? "Starting the camera…" : cameraError}</div>
            {cameraState === "error" && (
              <Button size="md" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </Button>
            )}
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "12px 0 0" }}>
        {cameraState === "scanning" ? "Point the camera at the member's code." : "Scanning needs the camera."}
      </div>
      {flash && <ErrorBanner text={flash} />}

      <Button variant="secondary" fullWidth style={{ marginTop: 18 }} onClick={() => setManualOpen(true)}>
        Find a client by name instead
      </Button>

      <ManualSheet
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onPick={(c) => {
          setManualOpen(false);
          handle(c.id, "manual");
        }}
      />
      <ConfirmCheckInSheet lookup={lookup} onClose={closeLookup} onDropIn={(c) => navigate(`/drop-in?${new URLSearchParams({ client: c.id, name: c.name })}`)} />
    </div>
  );
}

function ManualSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: ClientWithPackage) => void }) {
  const { data } = useAsync(() => (open ? api.clients() : Promise.resolve(null)), [open]);
  const { membershipTypes, bundleTypes } = useFrontDeskCatalog();
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>MANUAL CHECK-IN</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Find client</div>
      <ClientPicker clients={data?.clients ?? []} membershipTypes={membershipTypes} bundleTypes={bundleTypes} onPick={onPick} />
      <Button variant="quiet" fullWidth style={{ marginTop: 10 }} onClick={onClose}>
        Cancel
      </Button>
    </Sheet>
  );
}

function ConfirmCheckInSheet({ lookup, onClose, onDropIn }: { lookup: Lookup | null; onClose: () => void; onDropIn: (c: ClientWithPackage) => void }) {
  const shown = useLatch(lookup);
  const open = !!lookup;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);
  const { membershipTypes, bundleTypes } = useFrontDeskCatalog();

  useEffect(() => {
    if (lookup) setError(null);
  }, [lookup]);

  if (!shown) return null;
  const plan = planSummary(shown.client, membershipTypes, bundleTypes);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.checkIn(shown.client.id, shown.source);
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
        <SheetSuccessIcon label={`${shown.client.name} checked in`} iconIn={iconIn} />
      ) : (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{shown.source === "qr" ? "SCANNED" : "CHECK-IN"}</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{shown.client.name}</div>
          <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", flex: 1 }}>CURRENT PLAN</div>
              <PlanPill tone={plan.tone} />
            </div>
            <div style={{ font: "700 16px var(--font-body)", marginTop: 4 }}>{plan.title}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>{plan.detail}</div>
          </div>
          {error && <ErrorBanner text={error} />}
          {shown.eligible ? (
            <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={confirm}>
              {busy ? "Checking in…" : "Confirm check-in"}
            </Button>
          ) : (
            <>
              <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--logging-fg)", background: "var(--logging-bg)", borderRadius: 14, padding: "10px 14px" }}>
                No active membership or package — they can pay for a drop-in, or renew from their client page.
              </div>
              <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={() => onDropIn(shown.client)}>
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

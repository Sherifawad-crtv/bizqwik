import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { startQrCamera } from "../lib/qrCamera";
import { Icon } from "./Icon";
import { Button } from "./Button";

const REGION_ID = "bq-qr-reader";

// getUserMedia error -> something a coach can act on.
function cameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : (err as { name?: string } | undefined)?.name;
  if (!window.isSecureContext) return "The camera needs a secure (https) connection. Open the app from its normal link.";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera access is blocked. Allow camera access for this site in your browser settings, then try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera is in use by another app. Close it and try again.";
    default:
      return "Couldn't start the camera. Check the camera permission and try again.";
  }
}

/** Full-screen camera that reads one QR code and hands back its text.
 * Tests (no camera) can feed a code with
 * `window.dispatchEvent(new CustomEvent("bq-test-scan", { detail: "…" }))`. */
export function QrScanner({ title, hint, onClose, onScan }: { title: string; hint: string; onClose: () => void; onScan: (text: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const doneRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let alive = true;
    let stopCamera: (() => void) | null = null;
    doneRef.current = false;
    const finish = (text: string) => {
      if (doneRef.current || !alive) return;
      doneRef.current = true;
      stopCamera?.();
      onScanRef.current(text.trim());
    };
    const onTest = (e: Event) => finish(String((e as CustomEvent).detail ?? ""));
    window.addEventListener("bq-test-scan", onTest);

    const video = videoRef.current;
    if (video) {
      startQrCamera(video, finish)
        .then((stop) => {
          if (alive) stopCamera = stop;
          else stop();
        })
        .catch((err) => {
          if (alive) setError(cameraError(err));
        });
    }

    return () => {
      alive = false;
      window.removeEventListener("bq-test-scan", onTest);
      stopCamera?.();
    };
  }, [attempt]);

  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "calc(env(safe-area-inset-top) + 18px) 18px 12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "800 22px/1.2 var(--font-body)" }}>{title}</div>
          <div style={{ font: "400 13px/1.4 var(--font-mono)", color: "rgba(255,255,255,.7)", marginTop: 4 }}>{hint}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close scanner"
          style={{ width: 40, height: 40, flex: "none", borderRadius: 999, border: 0, background: "rgba(255,255,255,.14)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ position: "relative", width: "100%", maxWidth: 420 }}>
          <div id={REGION_ID} className="bq-qr-region" style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 28, overflow: "hidden", background: "#111" }}>
            <video ref={videoRef} playsInline muted autoPlay />
          </div>
          {!error && (
            <div aria-hidden style={{ position: "absolute", inset: "14%", border: "3px solid var(--primary)", borderRadius: 24, pointerEvents: "none" }} />
          )}
        </div>
      </div>
      {error && (
        <div style={{ margin: "0 16px calc(env(safe-area-inset-bottom) + 18px)", background: "var(--surface)", color: "var(--ink)", borderRadius: 20, padding: 16 }}>
          <div style={{ font: "600 14px/1.5 var(--font-body)", marginBottom: 12 }}>{error}</div>
          <Button fullWidth onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Try again</Button>
        </div>
      )}
    </div>,
    document.body,
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findWideLens, setCameraZoom, startQrCamera, type WideLens } from "./qrCamera";
import { Icon } from "./Icon";
import { Button } from "./Button";

const REGION_ID = "bq-qr-reader";

// The coach's last lens choice (0.5× is handy for scanning up close), kept per device.
const LENS_KEY = "bq_scan_lens";
type Lens = "1" | "0.5";
function savedLens(): Lens {
  try {
    return localStorage.getItem(LENS_KEY) === "0.5" ? "0.5" : "1";
  } catch {
    return "1";
  }
}

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
    case "SecurityError":
      return "This browser blocked the camera for this page. Open the app in Safari or Chrome directly (not inside another app), then try again.";
    default:
      return `Couldn't start the camera (${name ?? "unknown error"}). Check the camera permission and try again.`;
  }
}

/** Full-screen camera that reads one QR code and hands back its text.
 * Tests (no camera) can feed a code with
 * `window.dispatchEvent(new CustomEvent("bq-test-scan", { detail: "…" }))`. */
export function QrScanner({ title, hint, onClose, onScan }: { title: string; hint: string; onClose: () => void; onScan: (text: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The camera was granted but no picture arrived (seen on some phones right
  // after the permission prompt, or in installed home-screen apps): offer a
  // tap to start it, which also counts as the user gesture some phones want.
  const [stalled, setStalled] = useState(false);
  const doneRef = useRef(false);
  const onScanRef = useRef(onScan);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 0.5× (ultra-wide): offered only when this phone exposes it (see findWideLens).
  const [wide, setWide] = useState<WideLens | null>(null);
  const [lens, setLens] = useState<Lens>(savedLens);
  const [cameraDevice, setCameraDevice] = useState<string | undefined>(undefined);
  const lensRef = useRef(lens);
  // Latest values for the camera callbacks, which outlive a render.
  useLayoutEffect(() => {
    onScanRef.current = onScan;
    lensRef.current = lens;
  });
  const wideRef = useRef<WideLens | null>(null);
  const trackRef = useRef<MediaStreamTrack | undefined>(undefined);

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
    let watchdog: number | undefined;
    setStalled(false);
    if (video) {
      startQrCamera(video, finish, { deviceId: cameraDevice })
        .then(async (stop) => {
          if (!alive) return stop();
          stopCamera = stop;
          trackRef.current = stop.track;
          // Lens labels/capabilities are only readable once the camera is open.
          if (!wideRef.current) {
            const found = await findWideLens(stop.track);
            if (!alive) return;
            wideRef.current = found;
            setWide(found);
            if (found?.kind === "device" && lensRef.current === "0.5") setCameraDevice(found.deviceId);
          }
          const w = wideRef.current;
          if (w?.kind === "zoom" && lensRef.current === "0.5") await setCameraZoom(stop.track, w.zoom);
          watchdog = window.setTimeout(() => {
            if (alive && !doneRef.current && video.videoWidth === 0) setStalled(true);
          }, 2500);
        })
        .catch((err) => {
          if (alive) setError(cameraError(err));
        });
    }

    return () => {
      alive = false;
      window.clearTimeout(watchdog);
      window.removeEventListener("bq-test-scan", onTest);
      stopCamera?.();
    };
  }, [attempt, cameraDevice]);

  const chooseLens = (next: Lens) => {
    setLens(next);
    try {
      localStorage.setItem(LENS_KEY, next);
    } catch {
      // storage blocked: the choice just won't be remembered
    }
    const w = wideRef.current;
    if (!w) return;
    if (w.kind === "zoom") void setCameraZoom(trackRef.current, next === "0.5" ? w.zoom : 1);
    else setCameraDevice(next === "0.5" ? w.deviceId : undefined);
  };

  // Within the tap: play the stream we already have; if the picture still
  // doesn't come, open the camera again from scratch.
  const startFromTap = () => {
    const video = videoRef.current;
    setStalled(false);
    video?.play().catch(() => undefined);
    window.setTimeout(() => {
      if (!doneRef.current && (!video || video.videoWidth === 0)) setAttempt((n) => n + 1);
    }, 1200);
  };

  return createPortal(
    <div className="bq-qr-scanner-stack"
      role="dialog"
      aria-label={title}
    >
      <div className="bq-qr-scanner-row">
        <div className="bq-grow">
          <div className="bq-qr-scanner-title">{title}</div>
          <div className="bq-qr-scanner-meta">{hint}</div>
        </div>
        <button className="bq-hit bq-qr-scanner-btn"
          onClick={onClose}
          aria-label="Close scanner"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="bq-qr-scanner-row-2">
        <div className="bq-qr-scanner-size">
          <div id={REGION_ID} className="bq-qr-region bq-qr-scanner-box">
            <video ref={videoRef} playsInline muted autoPlay />
          </div>
          {!error && !stalled && (
            <div className="bq-qr-scanner-layer" aria-hidden />
          )}
          {!error && !stalled && wide && (
            <div className="bq-qr-scanner-row-3" role="group" aria-label="Camera lens">
              {(["0.5", "1"] as Lens[]).map((l) => (
                <button className="bq-qr-scanner-btn-2"
                  key={l}
                  onClick={() => chooseLens(l)}
                  aria-pressed={lens === l}
                  aria-label={l === "0.5" ? "Wide lens 0.5×" : "Normal lens 1×"}
                  style={{ background: lens === l ? "var(--color-bg-fill-on-media-selected)" : "transparent", color: lens === l ? "var(--color-text-on-media-selected)" : "var(--color-text-on-media-default)" }}
                >
                  {l === "0.5" ? ".5×" : "1×"}
                </button>
              ))}
            </div>
          )}
          {!error && stalled && (
            <div className="bq-qr-scanner-row-4">
              <Button onClick={startFromTap}>Tap to start the camera</Button>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="bq-qr-scanner-box-2">
          <div className="bq-qr-scanner-text">{error}</div>
          <Button fullWidth onClick={() => { setError(null); setAttempt((n) => n + 1); }}>Try again</Button>
        </div>
      )}
    </div>,
    document.body,
  );
}

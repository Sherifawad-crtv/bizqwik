import jsQR from "jsqr";

// Opens the rear camera into `video` and calls `onCode` with the first QR code
// it reads. Uses the browser's native BarcodeDetector when it supports QR
// (Chrome on Android), otherwise decodes frames with jsQR — which is what runs
// on iPhones. Returns a stop function that releases the camera.
//
// (Replaces html5-qrcode, which rendered the camera fine but never decoded.)

type Detector = {
  detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

async function nativeDetector(): Promise<Detector | null> {
  const BD = (
    window as unknown as {
      BarcodeDetector?: {
        new (o: { formats: string[] }): Detector;
        getSupportedFormats?: () => Promise<string[]>;
      };
    }
  ).BarcodeDetector;
  if (!BD) return null;
  try {
    const formats = (await BD.getSupportedFormats?.()) ?? [];
    return formats.includes("qr_code")
      ? new BD({ formats: ["qr_code"] })
      : null;
  } catch {
    return null;
  }
}

async function openCamera(deviceId?: string): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new DOMException("Camera API unavailable", "NotSupportedError");
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // A specific lens (the ultra-wide "0.5×") when asked for, else the back camera.
        ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  } catch (err) {
    // Some devices reject the size/facing hints outright — retry with no hints.
    if ((err as DOMException)?.name === "OverconstrainedError")
      return navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    throw err;
  }
}

/** How this phone can show the ultra-wide ("0.5×") view, if at all: by zooming
 * the current back camera out below 1× (recent iPhones, many Androids), or by
 * switching to the separately listed ultra-wide camera. */
export type WideLens = { kind: "zoom"; zoom: number } | { kind: "device"; deviceId: string };

export async function findWideLens(track: MediaStreamTrack | undefined): Promise<WideLens | null> {
  if (!track) return null;
  try {
    const caps = (track.getCapabilities?.() ?? {}) as { zoom?: { min: number; max: number } };
    if (caps.zoom && caps.zoom.min < 1) return { kind: "zoom", zoom: Math.max(caps.zoom.min, 0.5) };
    const current = track.getSettings?.().deviceId;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const wide = devices.find((d) => d.kind === "videoinput" && /ultra\s*-?wide/i.test(d.label) && d.deviceId !== current);
    if (wide) return { kind: "device", deviceId: wide.deviceId };
  } catch {
    // No capability info on this browser: just don't offer 0.5×.
  }
  return null;
}

/** Zoom the running camera (for WideLens "zoom"); false if it refused. */
export async function setCameraZoom(track: MediaStreamTrack | undefined, zoom: number): Promise<boolean> {
  if (!track) return false;
  try {
    await track.applyConstraints({ advanced: [{ zoom } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}

export type QrCamera = (() => void) & { track: MediaStreamTrack | undefined };

export async function startQrCamera(
  video: HTMLVideoElement,
  onCode: (text: string) => void,
  opts: { deviceId?: string } = {},
): Promise<QrCamera> {
  const stream = await openCamera(opts.deviceId);
  let stopped = false;
  let timer: number | undefined;
  const stop = () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    // Only detach our own stream: a newer session (e.g. React re-mounting the
    // scanner) may already have attached its stream to the same element.
    if (video.srcObject === stream) video.srcObject = null;
  };

  // iOS needs these set before play() or the video stays black / goes fullscreen.
  video.setAttribute("playsinline", "true");
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;
  // Don't wait on play() forever: with a camera that isn't delivering frames
  // yet it can stay pending, and the caller needs control back to recover.
  await Promise.race([
    video.play().catch(() => {
      // Autoplay can reject spuriously; frames still arrive once metadata loads.
    }),
    new Promise((resolve) => window.setTimeout(resolve, 1500)),
  ]);

  const detector = await nativeDetector();
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const tick = async () => {
    if (stopped) return;
    let text: string | null = null;
    try {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        if (detector) {
          const found = await detector.detect(video);
          text = found[0]?.rawValue ?? null;
        } else if (ctx) {
          // Decode a downscaled frame: plenty of detail for a code filling part
          // of the view, and fast enough to run several times a second.
          const scale = Math.min(
            1,
            720 / Math.max(video.videoWidth, video.videoHeight),
          );
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          text =
            jsQR(img.data, img.width, img.height, {
              inversionAttempts: "attemptBoth",
            })?.data ?? null;
        }
      }
    } catch {
      // A single bad frame isn't fatal — try the next one.
    }
    if (stopped) return;
    if (text) {
      stop();
      onCode(text.trim());
      return;
    }
    timer = window.setTimeout(tick, 120);
  };
  tick();
  return Object.assign(stop, { track: stream.getVideoTracks()[0] });
}

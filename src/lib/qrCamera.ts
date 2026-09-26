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

async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia)
    throw new DOMException("Camera API unavailable", "NotSupportedError");
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
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

export async function startQrCamera(
  video: HTMLVideoElement,
  onCode: (text: string) => void,
): Promise<() => void> {
  const stream = await openCamera();
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
  return stop;
}

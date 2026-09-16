type AudioContextCtor = typeof AudioContext;
type BellPartial = { ratio: number; gain: number; decay: number };

const FUNDAMENTAL = 660; // E5 — soft, not shrill

// A handful of slightly-inharmonic partials, each fading at its own rate, is
// what makes a struck bell shimmer instead of sounding like a flat test
// tone — real bells are a fundamental plus overtones that ring out and
// decay at different speeds, not a single pure sine.
const BELL_PARTIALS: BellPartial[] = [
  { ratio: 1, gain: 0.22, decay: 1.1 },
  { ratio: 2, gain: 0.12, decay: 0.85 },
  { ratio: 2.76, gain: 0.07, decay: 0.6 },
  { ratio: 4.07, gain: 0.045, decay: 0.4 },
];

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

// iOS Safari only lets an AudioContext resume from a suspended state inside
// a user gesture. Our chime fires after `await onConfirm()` resolves —
// outside that gesture — so without priming it once up front on the first
// tap anywhere in the app, it can be silently dropped there. Retries on
// each tap until the resume actually succeeds.
function tryUnlock() {
  const audioCtx = getContext();
  if (!audioCtx) return;
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  } else {
    window.removeEventListener("pointerdown", tryUnlock);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", tryUnlock, { passive: true });
}

/** Plays a soft struck-bell chime alongside the sheet success icon.
 * Synthesized with the Web Audio API — no shipped audio asset. Silently
 * no-ops if audio is unavailable or blocked — it's a nice-to-have and must
 * never break the confirmation flow itself. */
export function playSuccessChime() {
  try {
    const audioCtx = getContext();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

    const now = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.value = 0.5;
    master.connect(audioCtx.destination);

    for (const { ratio, gain, decay } of BELL_PARTIALS) {
      const osc = audioCtx.createOscillator();
      const env = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = FUNDAMENTAL * ratio;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(env).connect(master);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    }
  } catch {
    // never let a sound glitch break the confirmation flow
  }
}

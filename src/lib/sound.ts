type AudioContextCtor = typeof AudioContext;

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

// A quiet octave-up partial layered under each note's fundamental gives it a
// soft bell-like warmth without the long single-note "ring" of a struck
// bell — this is a quick two-note confirmation chime, Apple Pay/App
// Store-style, not a chapel bell.
function note(audioCtx: AudioContext, freq: number, start: number, duration: number, peakGain: number) {
  const play = (f: number, gainScale: number, decayScale: number) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain * gainScale, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration * decayScale);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };
  play(freq, 1, 1);
  play(freq * 2, 0.22, 0.55);
}

/** Plays a soft two-note confirmation chime alongside the sheet success
 * icon. Synthesized with the Web Audio API — no shipped audio asset.
 * Silently no-ops if audio is unavailable or blocked — it's a nice-to-have
 * and must never break the confirmation flow itself. */
export function playSuccessChime() {
  try {
    const audioCtx = getContext();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});

    const now = audioCtx.currentTime;
    note(audioCtx, 830.61, now, 0.16, 0.16); // G#5
    note(audioCtx, 1244.51, now + 0.085, 0.22, 0.14); // D#6, a fifth up
  } catch {
    // never let a sound glitch break the confirmation flow
  }
}

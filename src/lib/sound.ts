type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// A quiet octave-up partial layered under the fundamental gives each note a
// bell/marimba-like character instead of a flat test-tone sine — closer to
// the soft "tap" quality of Apple Pay/App Store-style confirmation chimes.
function tone(audioCtx: AudioContext, freq: number, start: number, duration: number, peakGain: number) {
  const play = (f: number, gainScale: number, decayScale: number) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peakGain * gainScale, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration * decayScale);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };
  play(freq, 1, 1);
  play(freq * 2, 0.25, 0.6);
}

/** Short two-note ascending chime played alongside the sheet success icon —
 * synthesized rather than a shipped audio asset, so it's instant and free of
 * file weight/licensing. Silently no-ops if audio is unavailable or blocked
 * (no user gesture yet, reduced-data mode, etc.) — it's a nice-to-have and
 * must never break the confirmation flow itself. */
export function playSuccessChime() {
  try {
    const audioCtx = getContext();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    tone(audioCtx, 830.61, now, 0.13, 0.18); // G#5
    tone(audioCtx, 1244.51, now + 0.075, 0.2, 0.16); // D#6, a fifth up
  } catch {
    // never let a sound glitch break the confirmation flow
  }
}

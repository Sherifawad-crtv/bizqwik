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

function tone(audioCtx: AudioContext, freq: number, start: number, duration: number, peakGain: number) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
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
    tone(audioCtx, 880, now, 0.16, 0.18);
    tone(audioCtx, 1318.51, now + 0.09, 0.22, 0.16);
  } catch {
    // never let a sound glitch break the confirmation flow
  }
}

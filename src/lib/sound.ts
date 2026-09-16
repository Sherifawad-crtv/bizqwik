const SUCCESS_SOUND_SRC = "/sounds/success.mp3";
const SUCCESS_VOLUME = 0.6;

let successAudio: HTMLAudioElement | null = null;

function getSuccessAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!successAudio) {
    successAudio = new Audio(SUCCESS_SOUND_SRC);
    successAudio.volume = SUCCESS_VOLUME;
    successAudio.preload = "auto";
  }
  return successAudio;
}

/** Plays the success chime alongside the sheet success icon. Silently no-ops
 * if audio is unavailable or blocked (no user gesture yet, reduced-data
 * mode, etc.) — it's a nice-to-have and must never break the confirmation
 * flow itself. */
export function playSuccessChime() {
  try {
    const audio = getSuccessAudio();
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  } catch {
    // never let a sound glitch break the confirmation flow
  }
}

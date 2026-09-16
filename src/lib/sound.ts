const SUCCESS_SOUND_SRC = "/sounds/success.mp3";
const SUCCESS_VOLUME = 0.6;

// Created eagerly at module load, not lazily on first play — waiting until
// the first confirmation to construct the element meant that play always
// raced the network fetch of the mp3, which is exactly what read as "the
// sound is delayed or doesn't play". Creating it up front gives the browser
// a head start on fetching/decoding well before anyone taps a confirm CTA.
const successAudio: HTMLAudioElement | null = typeof window !== "undefined" && typeof Audio !== "undefined" ? new Audio() : null;
if (successAudio) {
  successAudio.preload = "auto";
  successAudio.volume = SUCCESS_VOLUME;
  successAudio.src = SUCCESS_SOUND_SRC;
}

let unlocked = false;

// iOS Safari only lets audio start inside a synchronous user-gesture
// handler — our chime instead fires after `await onConfirm()` resolves, so
// without this it's silently dropped on iOS. Priming playback (muted, then
// immediately paused) on the very first tap anywhere in the app satisfies
// that requirement once per session; every later programmatic play() then
// works normally regardless of the gesture chain. Retries on each tap until
// it actually succeeds, since the very first tap can itself be too early
// (audio metadata not yet loaded) on a slow connection.
function tryUnlock() {
  if (unlocked || !successAudio) return;
  successAudio.muted = true;
  successAudio
    .play()
    .then(() => {
      successAudio.pause();
      successAudio.currentTime = 0;
      successAudio.muted = false;
      unlocked = true;
      window.removeEventListener("pointerdown", tryUnlock);
    })
    .catch(() => {
      successAudio.muted = false;
    });
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", tryUnlock, { passive: true });
}

/** Plays the success chime alongside the sheet success icon. Silently no-ops
 * if audio is unavailable or blocked — it's a nice-to-have and must never
 * break the confirmation flow itself. */
export function playSuccessChime() {
  if (!successAudio) return;
  try {
    successAudio.currentTime = 0;
  } catch {
    // not loaded yet — play() below still starts from the beginning
  }
  successAudio.play().catch(() => {});
}

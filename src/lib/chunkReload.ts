// After an update, the files of the previous version no longer exist on the
// server. An app that was already open still asks for them, and the screen it
// was loading fails ("'text/html' is not a valid JavaScript MIME type", "Failed
// to fetch dynamically imported module", …). Reloading once fetches the new
// version, which is what the person needs anyway.

const KEY = "bizqwik:reloadedForUpdate";
// A second failure this soon after a reload isn't an out-of-date app (the new
// version's files are missing too), so it must surface instead of looping.
const COOLDOWN_MS = 30_000;

/** Does this error mean "a file of the app couldn't be downloaded"? */
export function isChunkLoadError(err: unknown): boolean {
  const msg = String((err as { message?: unknown } | null)?.message ?? err ?? "");
  return /dynamically imported module|importing a module script failed|not a valid javascript mime type|unable to preload|loading (css )?chunk .* failed/i.test(msg);
}

/** Reload the page once to pick up the new version. Returns false when it
 * shouldn't (offline, or it already reloaded a moment ago), so the caller can
 * show the error instead. */
export function reloadForUpdate(): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Without storage there's no way to tell a second failure from a first,
    // and a reload loop is worse than an error.
    return false;
  }
  window.location.reload();
  return true;
}

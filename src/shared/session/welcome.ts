// The welcome screen is for a device's very first visit. Once someone has seen
// it (or has ever been signed in here) it never comes back — a signed-out user
// goes straight to the normal sign-in page.
const KEY = "bizqwik.welcomed";

export function hasSeenWelcome(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Storage blocked: don't trap them on the welcome screen.
    return true;
  }
}

export function markWelcomed(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}

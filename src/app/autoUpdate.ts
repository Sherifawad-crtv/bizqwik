declare const __BUILD_ID__: string;

// Installed home-screen apps (iPhone especially) can stay alive in memory for
// days and keep running an old copy after a release. Whenever the app comes
// back to the screen, compare this copy with the live one and reload if a
// newer version is out. Only on return to the screen, never mid-use, and at
// most once per new version (so a slow CDN can never cause a reload loop).
export function startAutoUpdate() {
  if (import.meta.env.DEV) return;
  let checking = false;
  const check = async () => {
    if (checking || document.visibilityState !== "visible") return;
    checking = true;
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;
      const { build } = (await res.json()) as { build?: string };
      if (!build || build === __BUILD_ID__) return;
      const key = "bq_reloaded_for";
      if (sessionStorage.getItem(key) === build) return;
      sessionStorage.setItem(key, build);
      window.location.reload();
    } catch {
      // Offline or storage blocked: try again next time the app is shown.
    } finally {
      checking = false;
    }
  };
  document.addEventListener("visibilitychange", check);
  window.addEventListener("pageshow", (e) => {
    if ((e as PageTransitionEvent).persisted) check();
  });
  check();
}

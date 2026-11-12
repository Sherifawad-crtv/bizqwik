import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { waitForFirstScreen } from "../lib/useAsync";
import { track } from "../lib/analytics";

/** The launch screen: the full Bizqwik logo with a small spinner under it.
 * index.html paints the same thing before the app has loaded, so launching
 * never flashes blank or jumps. */
export function Splash() {
  return (
    <div
      data-testid="splash"
      role="status"
      aria-label="Loading Bizqwik"
      style={{ minHeight: "100svh", background: "var(--paper)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}
    >
      <img src="/wordmark.png" alt="Bizqwik" style={{ height: 44, width: "auto", display: "block" }} />
      <div style={{ width: 24, height: 24, borderRadius: 999, border: "3px solid var(--primary-tint)", borderTopColor: "var(--primary)", animation: "bqSpin .7s linear infinite" }} />
    </div>
  );
}

/** The launch screen covers start-up until we know who's signed in. The app is
 * mounted under it at once (so the first screen's requests start immediately)
 * and the splash lifts when that data lands, or after at most 450 ms, whichever
 * is first. A slow connection then shows the screen's placeholders, not a
 * logo. No minimum hold. */
export function LaunchGate({ children }: { children: ReactNode }) {
  const { ready, profile, bizqwikTeam } = useAuth();
  const signedIn = !!profile || !!bizqwikTeam;
  const [covered, setCovered] = useState(true);
  useEffect(() => {
    if (!ready) return;
    // Signed out: the sign-in screen has nothing to load, so show it straight away.
    if (!signedIn) {
      setCovered(false);
      return;
    }
    let alive = true;
    waitForFirstScreen(450).then(() => {
      if (!alive) return;
      setCovered(false);
      // How long the person waited from opening the app to a finished first screen.
      track("launch_ready", { ms: Math.round(performance.now()) });
    });
    return () => {
      alive = false;
    };
  }, [ready, signedIn]);
  if (!ready) return <Splash />;
  return (
    <>
      {children}
      {covered && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
          <Splash />
        </div>
      )}
    </>
  );
}

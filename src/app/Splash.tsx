import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../shared/session/auth";
import { waitForFirstScreen } from "../shared/api/useAsync";
import { track } from "../shared/platform/analytics";
import "./Splash.css";

/** The launch screen: the full Bizqwik logo with a small spinner under it.
 * index.html paints the same thing before the app has loaded, so launching
 * never flashes blank or jumps. */
export function Splash() {
  return (
    <div className="bq-splash-stack"
      data-testid="splash"
      role="status"
      aria-label="Loading Bizqwik"
    >
      <img className="bq-splash-img" src="/wordmark.png" alt="Bizqwik" />
      <div className="bq-splash-box" />
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
        <div className="bq-splash-launch-gate-layer">
          <Splash />
        </div>
      )}
    </>
  );
}

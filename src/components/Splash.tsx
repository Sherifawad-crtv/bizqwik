import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import { waitForLoadsToFinish } from "../lib/useAsync";

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

/** The launch screen covers the whole start-up: first who's signed in, then
 * the first screen's own data. The app is mounted under it as soon as we know
 * who's in (so that screen's requests start at once) and the splash lifts when
 * they've landed, so there is one loader, not a splash followed by a spinner.
 * No minimum hold: it goes the moment everything is ready. A request that
 * never answers can't trap the user behind it (capped at 8 seconds). */
export function LaunchGate({ children }: { children: ReactNode }) {
  const { ready } = useAuth();
  const [covered, setCovered] = useState(true);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    waitForLoadsToFinish(8000).then(() => alive && setCovered(false));
    return () => {
      alive = false;
    };
  }, [ready]);
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

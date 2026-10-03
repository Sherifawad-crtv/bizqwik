import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";

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

const MIN_MS = 600;

/** Holds the launch screen until we know who's signed in, and just long
 * enough that it reads as a screen rather than a flicker. */
export function LaunchGate({ children }: { children: ReactNode }) {
  const { ready } = useAuth();
  const [held, setHeld] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setHeld(false), MIN_MS);
    return () => window.clearTimeout(t);
  }, []);
  if (!ready || held) return <Splash />;
  return <>{children}</>;
}

import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../../shared/session/auth";
import { hasSeenWelcome } from "../../../shared/session/welcome";
import { useIsMobile } from "../../../design-system/hooks/useIsMobile";
import { useKeyboardInset } from "../../../design-system/hooks/useKeyboardInset";
import { DesktopAuth } from "./DesktopAuth";
import { Button } from "../../../design-system/components/Button";
import "./Login.css";

const KEYBOARD_THRESHOLD = 80; // ignore small viewport jitter from browser chrome

function focusIntoView(e: React.FocusEvent<HTMLInputElement>) {
  const el = e.target;
  window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}

export function Login() {
  const { profile, bizqwikTeam, ready, login } = useAuth();
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset(isMobile);
  const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Always land on the role's default screen after signing in — not
  // wherever a lapsed session happened to leave off (e.g. Manage). An org
  // profile wins at "/"; a profile-less Bizqwik-team member goes to ops.
  if (ready && profile) return <Navigate to="/" replace />;
  if (ready && bizqwikTeam) return <Navigate to="/bizqwik" replace />;
  // A brand-new device meets the welcome screen first (once).
  if (ready && isMobile && !hasSeenWelcome()) return <Navigate to="/welcome" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <div className="bq-card" style={{ width: isMobile ? "min(var(--size-column), 100%)" : "min(580px, 100%)", padding: isMobile ? 30 : 48 }}>
        <div className="bq-stat-lg">Sign in</div>
        <div className="bq-auth-login-meta">
          ATTENDANCE &amp; PAYOUT PORTAL
        </div>

        <form onSubmit={submit} className="bq-stack">
          <label className="bq-auth-login-label">
            <span className="bq-label">EMAIL</span>
            <input className="bq-auth-login-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={focusIntoView}
            />
          </label>
          <label className="bq-auth-login-label">
            <span className="bq-label">PASSWORD</span>
            <input className="bq-auth-login-input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={focusIntoView}
            />
          </label>
          <Link className="bq-auth-login-title"
            to="/forgot-password"
          >
            Forgot password?
          </Link>

          {error && (
            <div  className="bq-error bq-rise">
              {error}
            </div>
          )}

          <Button className="bq-mt-1" type="submit" fullWidth size="lg" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <Link className="bq-auth-login-title-2" to="/signup">
            First time? <span className="bq-auth-login-part">Create an account</span>
          </Link>
        </form>
      </div>
  );

  if (!isMobile) return <DesktopAuth>{card}</DesktopAuth>;

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "var(--color-bg-canvas-default)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: keyboardOpen ? "flex-start" : "center",
        gap: "clamp(20px, 4vh, 32px)",
        padding: 20,
        paddingBottom: keyboardOpen ? keyboardInset + 20 : 20,
        overflowY: isMobile ? "auto" : undefined,
      }}
    >
      <img className="bq-auth-login-img" src="/wordmark.png" alt="Bizqwik" />
      {card}
    </div>
  );
}

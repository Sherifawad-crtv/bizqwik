import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useIsMobile } from "../lib/useIsMobile";
import { useKeyboardInset } from "../lib/useKeyboardInset";
import { DesktopAuth } from "../components/DesktopAuth";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { api } from "../lib/backend";

const KEYBOARD_THRESHOLD = 80; // ignore small viewport jitter from browser chrome

function focusIntoView(e: React.FocusEvent<HTMLInputElement>) {
  const el = e.target;
  window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}

export function Signup() {
  const { profile, bizqwikTeam, ready, login } = useAuth();
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset(isMobile);
  const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && profile) return <Navigate to="/" replace />;
  if (ready && bizqwikTeam) return <Navigate to="/bizqwik" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      // The backend only creates the account if this email has a pending
      // invite (or is the very first account ever) — otherwise it rejects
      // with "You're not part of this organization." Doesn't itself
      // establish a session, so sign in right after, same as the login screen.
      await api.signup(name.trim(), email.trim(), password);
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const card = (
    <div className="bq-card" style={{ width: isMobile ? "min(420px, 100%)" : "min(580px, 100%)", padding: isMobile ? 30 : 48 }}>
        <div className="bq-stat-lg">Create account</div>
        <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", marginTop: 6, marginBottom: 22 }}>
          USE THE EMAIL YOU WERE INVITED WITH
        </div>

        <form onSubmit={submit} className="bq-stack">
          <TextField label="NAME" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} onFocus={focusIntoView} />
          <TextField label="EMAIL" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onFocus={focusIntoView} />
          <TextField
            label="PASSWORD"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={focusIntoView}
          />

          {error && (
            <div  className="bq-error bq-rise">
              {error}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
          <Link to="/login" style={{ textAlign: "center", font: "700 var(--text-footnote-size) var(--font-family-body)", color: "var(--color-text-secondary-default)", marginTop: 4 }}>
            Already have an account? <span style={{ color: "var(--color-bg-fill-primary-default)" }}>Sign in</span>
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
      <img src="/wordmark.png" alt="Bizqwik" style={{ height: "clamp(34px, 8vw, 42px)", width: "auto", display: "block" }} />
      {card}
    </div>
  );
}

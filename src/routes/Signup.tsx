import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useIsMobile } from "../lib/useIsMobile";
import { useKeyboardInset } from "../lib/useKeyboardInset";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { api } from "../lib/backend";

const KEYBOARD_THRESHOLD = 80; // ignore small viewport jitter from browser chrome

function focusIntoView(e: React.FocusEvent<HTMLInputElement>) {
  const el = e.target;
  window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
}

export function Signup() {
  const { profile, ready, login } = useAuth();
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset(isMobile);
  const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && profile) return <Navigate to="/" replace />;

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
      await api.signup(email.trim(), password);
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "var(--paper)",
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
      <div data-sq style={{ width: "min(420px, 100%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 30 }}>
        <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>Create account</div>
        <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 6, marginBottom: 22 }}>
          USE THE EMAIL YOU WERE INVITED WITH
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
          <Link to="/login" style={{ textAlign: "center", font: "700 13px var(--font-body)", color: "var(--ink-muted)", marginTop: 4 }}>
            Already have an account? Sign in
          </Link>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth";
import { useIsMobile } from "../../../design-system/hooks/useIsMobile";
import { useKeyboardInset } from "../../../design-system/hooks/useKeyboardInset";
import { DesktopAuth } from "./DesktopAuth";
import { Button } from "../../../design-system/components/Button";
import { TextField } from "../../../design-system/components/FormField";
import { useSignup } from "./hooks/useAuthActions";
import "./Signup.css";

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
  const { signup, busy, error } = useSignup(login);

  if (ready && profile) return <Navigate to="/" replace />;
  if (ready && bizqwikTeam) return <Navigate to="/bizqwik" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Sign-up doesn't itself start a session, so it signs in right after.
    await signup(name, email, password);
  };

  const card = (
    <div className="bq-card" style={{ width: isMobile ? "min(420px, 100%)" : "min(580px, 100%)", padding: isMobile ? 30 : 48 }}>
        <div className="bq-stat-lg">Create account</div>
        <div className="bq-auth-signup-meta">
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

          <Button className="bq-mt-1" type="submit" fullWidth size="lg" disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </Button>
          <Link className="bq-auth-signup-title" to="/login">
            Already have an account? <span className="bq-auth-signup-part">Sign in</span>
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
      <img className="bq-auth-signup-img" src="/wordmark.png" alt="Bizqwik" />
      {card}
    </div>
  );
}

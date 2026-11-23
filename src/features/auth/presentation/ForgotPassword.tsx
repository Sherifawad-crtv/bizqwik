import { useState } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "../../../design-system/hooks/useIsMobile";
import { useKeyboardInset } from "../../../design-system/hooks/useKeyboardInset";
import { Button } from "../../../design-system/components/Button";
import { TextField } from "../../../design-system/components/FormField";
import { usePasswordReset } from "./hooks/useAuthActions";
import "./ForgotPassword.css";

const KEYBOARD_THRESHOLD = 80;

export function ForgotPassword() {
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset(isMobile);
  const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { send, busy, error } = usePasswordReset();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await send(email)) setSent(true);
  };

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
      <img className="bq-auth-forgot-password-img" src="/wordmark.png" alt="Bizqwik" />
      <div className="bq-card bq-card--lg bq-auth-forgot-password-size">
        <div className="bq-stat-lg">Reset password</div>
        <div className="bq-auth-forgot-password-meta">
          {sent ? "CHECK YOUR EMAIL" : "WE'LL EMAIL YOU A RESET LINK"}
        </div>

        {sent ? (
          <>
            <div className="bq-auth-forgot-password-text">
              If an account exists for <strong>{email}</strong>, a password reset link is on its way.
            </div>
            <Link className="bq-block bq-mt-6" to="/login">
              <Button fullWidth size="lg">
                Back to sign in
              </Button>
            </Link>
          </>
        ) : (
          <form onSubmit={submit} className="bq-stack">
            <TextField
              label="EMAIL"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && (
              <div  className="bq-error bq-rise">
                {error}
              </div>
            )}

            <Button className="bq-mt-1" type="submit" fullWidth size="lg" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
            <Link className="bq-auth-forgot-password-title"
              to="/login"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

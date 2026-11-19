import { useState } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { useKeyboardInset } from "../../design-system/hooks/useKeyboardInset";
import { Button } from "../../design-system/components/Button";
import { TextField } from "../../design-system/components/FormField";
import { auth } from "../../shared/api/backend";

const KEYBOARD_THRESHOLD = 80;

export function ForgotPassword() {
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset(isMobile);
  const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD;
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.sendPasswordReset(email);
      setSent(true);
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
      <div className="bq-card bq-card--lg" style={{ width: "min(420px, 100%)" }}>
        <div className="bq-stat-lg">Reset password</div>
        <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", marginTop: 6, marginBottom: 22 }}>
          {sent ? "CHECK YOUR EMAIL" : "WE'LL EMAIL YOU A RESET LINK"}
        </div>

        {sent ? (
          <>
            <div style={{ font: "500 var(--text-body-size)/1.5 var(--font-family-body)", color: "var(--color-text-primary-default)" }}>
              If an account exists for <strong>{email}</strong>, a password reset link is on its way.
            </div>
            <Link to="/login" style={{ display: "block", marginTop: 22 }}>
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

            <Button type="submit" fullWidth size="lg" disabled={busy} style={{ marginTop: 4 }}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
            <Link
              to="/login"
              style={{ textAlign: "center", font: "700 var(--text-footnote-size) var(--font-family-body)", color: "var(--color-text-secondary-default)", marginTop: 4 }}
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

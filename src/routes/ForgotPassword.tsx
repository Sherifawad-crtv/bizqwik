import { useState } from "react";
import { Link } from "react-router-dom";
import { useIsMobile } from "../lib/useIsMobile";
import { useKeyboardInset } from "../lib/useKeyboardInset";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { auth } from "../lib/backend";

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
        <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>Reset password</div>
        <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 6, marginBottom: 22 }}>
          {sent ? "CHECK YOUR EMAIL" : "WE'LL EMAIL YOU A RESET LINK"}
        </div>

        {sent ? (
          <>
            <div style={{ font: "500 15px/1.5 var(--font-body)", color: "var(--ink)" }}>
              If an account exists for <strong>{email}</strong>, a password reset link is on its way.
            </div>
            <Link to="/login" style={{ display: "block", marginTop: 22 }}>
              <Button fullWidth size="lg">
                Back to sign in
              </Button>
            </Link>
          </>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField
              label="EMAIL"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            {error && (
              <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
                {error}
              </div>
            )}

            <Button type="submit" fullWidth size="lg" disabled={busy} style={{ marginTop: 4 }}>
              {busy ? "Sending…" : "Send reset link"}
            </Button>
            <Link
              to="/login"
              style={{ textAlign: "center", font: "700 13px var(--font-body)", color: "var(--ink-muted)", marginTop: 4 }}
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

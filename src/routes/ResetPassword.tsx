import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useIsMobile } from "../lib/useIsMobile";
import { useKeyboardInset } from "../lib/useKeyboardInset";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";
import { auth } from "../lib/backend";

const KEYBOARD_THRESHOLD = 80;

export function ResetPassword() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset(isMobile);
  const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await auth.updatePassword(password);
      navigate("/", { replace: true });
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
        <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>Set new password</div>
        <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 6, marginBottom: 22 }}>
          CHOOSE A NEW PASSWORD
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <TextField
            label="NEW PASSWORD"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <TextField
            label="CONFIRM PASSWORD"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />

          {error && (
            <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
              {error.toLowerCase().includes("session") && (
                <>
                  {" "}
                  <Link to="/forgot-password" style={{ textDecoration: "underline" }}>
                    Request a new link
                  </Link>
                  .
                </>
              )}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

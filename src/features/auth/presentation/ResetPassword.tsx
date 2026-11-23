import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useIsMobile } from "../../../design-system/hooks/useIsMobile";
import { useKeyboardInset } from "../../../design-system/hooks/useKeyboardInset";
import { Button } from "../../../design-system/components/Button";
import { TextField } from "../../../design-system/components/FormField";
import { useNewPassword } from "./hooks/useAuthActions";
import "./ResetPassword.css";

const KEYBOARD_THRESHOLD = 80;

export function ResetPassword() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const keyboardInset = useKeyboardInset(isMobile);
  const keyboardOpen = keyboardInset > KEYBOARD_THRESHOLD;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const { save, busy, error } = useNewPassword();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await save(password, confirm)) navigate("/", { replace: true });
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
      <img className="bq-auth-reset-password-img" src="/wordmark.png" alt="Bizqwik" />
      <div className="bq-card bq-card--lg bq-auth-reset-password-size">
        <div className="bq-stat-lg">Set new password</div>
        <div className="bq-auth-reset-password-meta">
          CHOOSE A NEW PASSWORD
        </div>

        <form onSubmit={submit} className="bq-stack">
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
            <div  className="bq-error bq-rise">
              {error}
              {error.toLowerCase().includes("session") && (
                <>
                  {" "}
                  <Link className="bq-auth-reset-password-part" to="/forgot-password">
                    Request a new link
                  </Link>
                  .
                </>
              )}
            </div>
          )}

          <Button className="bq-mt-1" type="submit" fullWidth size="lg" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

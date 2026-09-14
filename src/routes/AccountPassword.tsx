import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { auth } from "../lib/backend";
import { Button } from "../components/Button";
import { TextField } from "../components/FormField";

export function AccountPassword() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useSetHeader({ kicker: "ACCOUNT", title: "Change password" }, []);

  if (!profile) return null;

  const save = async () => {
    setError(null);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      // Re-verify the current password before changing anything — the update
      // itself only needs the active session, but confirming first stops
      // anyone with a briefly-unlocked device from silently taking over.
      await auth.signInWithPassword(profile.email, current);
      await auth.updatePassword(next);
      navigate("/account", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <TextField
            label="CURRENT PASSWORD"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <TextField
            label="NEW PASSWORD"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
          <TextField
            label="CONFIRM NEW PASSWORD"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {error && (
          <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
            {error}
          </div>
        )}
        <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save password"}
        </Button>
      </div>
    </div>
  );
}

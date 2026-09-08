import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/Button";

export function Login() {
  const { profile, ready, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Always land on the role's default screen after signing in — not
  // wherever a lapsed session happened to leave off (e.g. Manage).
  if (ready && profile) return <Navigate to="/" replace />;

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

  return (
    <div
      style={{
        minHeight: "100svh",
        background: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div data-sq style={{ width: "min(420px, 100%)", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 30 }}>
        <div style={{ width: 44, height: 44, borderRadius: "var(--r-tile)", background: "var(--primary)", color: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", font: "800 18px var(--font-body)", marginBottom: 18 }} data-sq>
          B
        </div>
        <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>Sign in to Bizqwik</div>
        <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 6, marginBottom: 22 }}>
          ATTENDANCE &amp; PAYOUT PORTAL
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label data-sq style={{ display: "block", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px" }}>
            <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>EMAIL</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ display: "block", width: "100%", border: 0, background: "none", outline: "none", font: "600 16px var(--font-body)", color: "var(--ink)", padding: "2px 0 0" }}
            />
          </label>
          <label data-sq style={{ display: "block", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px" }}>
            <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>PASSWORD</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ display: "block", width: "100%", border: 0, background: "none", outline: "none", font: "600 16px var(--font-body)", color: "var(--ink)", padding: "2px 0 0" }}
            />
          </label>

          {error && (
            <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
            </div>
          )}

          <Button type="submit" fullWidth size="lg" disabled={busy} style={{ marginTop: 4 }}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}

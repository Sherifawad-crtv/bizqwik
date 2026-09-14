import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { TextField } from "../components/FormField";
import { ROLE_LABELS } from "../lib/types";
import { auth } from "../lib/backend";

export function Account() {
  const { profile, tier, logout } = useAuth();
  const navigate = useNavigate();
  const [changingPassword, setChangingPassword] = useState(false);

  useSetHeader({ kicker: "ACCOUNT", title: "Account" }, []);

  if (!profile) return null;

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div>
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 24, display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <Avatar name={profile.name} size={56} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "800 22px var(--font-body)", letterSpacing: "-.01em" }}>{profile.name}</div>
          <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{profile.email}</div>
        </div>
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "6px 4px", marginBottom: 16 }}>
        {[
          { k: "ROLE", v: ROLE_LABELS[profile.role] },
          tier
            ? { k: "TIER", v: `${tier.name} · ${tier.rate} EGP / session` }
            : profile.role !== "accountant"
              ? { k: "TIER", v: "Not assigned — contact a department head." }
              : null,
        ]
          .filter((r): r is { k: string; v: string } => !!r)
          .map((r, i, arr) => <Row key={r.k} k={r.k} v={r.v} last={i === arr.length - 1} />)}
      </div>

      <Button variant="secondary" fullWidth size="lg" onClick={() => setChangingPassword(true)} style={{ gap: 10, marginBottom: 10 }}>
        <Icon name="settings" size={18} /> Change password
      </Button>

      <Button variant="danger" fullWidth size="lg" onClick={doLogout} style={{ gap: 10 }}>
        <Icon name="logout" size={18} /> Sign out
      </Button>

      <ChangePasswordSheet open={changingPassword} email={profile.email} onClose={() => setChangingPassword(false)} />
    </div>
  );
}

function ChangePasswordSheet({ open, email, onClose }: { open: boolean; email: string; onClose: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrent("");
      setNext("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

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
      await auth.signInWithPassword(email, current);
      await auth.updatePassword(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>ACCOUNT</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Change password</div>
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
      <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
        Cancel
      </Button>
    </Sheet>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", width: 90, flex: "none" }}>{k}</span>
      <span style={{ font: "600 15px var(--font-body)", color: "var(--ink)", flex: 1, minWidth: 0 }}>{v}</span>
    </div>
  );
}

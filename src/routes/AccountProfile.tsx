import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { api } from "../lib/backend";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { TextField } from "../components/FormField";
import { ROLE_LABELS } from "../lib/types";

export function AccountProfile() {
  const { profile, tier, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useSetHeader({ kicker: "ACCOUNT", title: "Account settings" }, []);

  if (!profile) return null;

  const dirty = name.trim() !== profile.name && name.trim().length > 0;

  const save = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateMe(name.trim());
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        onClick={() => navigate("/account")}
        style={{ display: "flex", alignItems: "center", gap: 4, border: 0, background: "none", cursor: "pointer", color: "var(--ink-muted)", font: "600 13px var(--font-body)", padding: "0 0 14px" }}
      >
        <Icon name="chevron-left" size={16} /> Account
      </button>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 20, marginBottom: 16 }}>
        <TextField
          label="NAME"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        {error && (
          <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
            {error}
          </div>
        )}
        {saved && !error && (
          <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--primary-pressed)", background: "var(--primary-tint)", borderRadius: 14, padding: "10px 14px" }}>
            Saved.
          </div>
        )}
        <Button fullWidth size="lg" style={{ marginTop: 14 }} disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : "Save name"}
        </Button>
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "6px 4px", marginBottom: 12 }}>
        <Row k="EMAIL" v={profile.email} />
        <Row k="ROLE" v={ROLE_LABELS[profile.role]} last={profile.role === "accountant"} />
        {profile.role !== "accountant" && (
          <Row k="TIER" v={tier ? `${tier.name} · ${tier.rate} EGP / session` : "Not assigned"} last />
        )}
      </div>
      <div style={{ padding: "0 4px", font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
        Email, role, and tier are managed by a department head.
      </div>
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", width: 90, flex: "none" }}>{k}</span>
      <span style={{ font: "600 15px var(--font-body)", color: "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

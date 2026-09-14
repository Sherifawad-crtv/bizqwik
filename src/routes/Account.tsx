import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { ROLE_LABELS } from "../lib/types";

export function Account() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  useSetHeader({ kicker: "ACCOUNT", title: "Account" }, []);

  if (!profile) return null;

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "24px 0 28px" }}>
        <Avatar name={profile.name} size={120} src={profile.avatarUrl} />
        <div style={{ font: "800 24px var(--font-body)", letterSpacing: "-.01em", marginTop: 12 }}>{profile.name}</div>
        <div style={{ font: "600 14px var(--font-body)", color: "var(--ink-faint)" }}>{ROLE_LABELS[profile.role]}</div>
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "6px 4px", marginBottom: 16 }}>
        <SettingsRow icon="account" label="Account Settings" onClick={() => navigate("/account/profile")} />
        <SettingsRow icon="lock" label="Password Settings" onClick={() => navigate("/account/password")} last />
      </div>

      <Button variant="danger" fullWidth size="lg" onClick={doLogout} style={{ gap: 10 }}>
        <Icon name="logout" size={18} /> Sign out
      </Button>
    </div>
  );
}

function SettingsRow({ icon, label, onClick, last }: { icon: IconName; label: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        border: 0,
        background: "none",
        cursor: "pointer",
        padding: "14px 16px",
        font: "600 15px var(--font-body)",
        color: "var(--ink)",
        textAlign: "left",
        borderBottom: last ? "none" : "1px solid var(--line)",
      }}
    >
      <span style={{ flex: "none", display: "flex", color: "var(--ink-muted)" }}>
        <Icon name={icon} size={19} />
      </span>
      {label}
    </button>
  );
}

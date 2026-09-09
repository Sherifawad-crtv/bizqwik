import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { ROLE_LABELS } from "../lib/types";

export function Account() {
  const { profile, tier, logout } = useAuth();
  const navigate = useNavigate();

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

      <Button variant="danger" fullWidth size="lg" onClick={doLogout} style={{ gap: 10 }}>
        <Icon name="logout" size={18} /> Sign out
      </Button>
    </div>
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

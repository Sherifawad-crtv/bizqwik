import { NavLink } from "react-router-dom";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { useAuth } from "../lib/auth";
import { NAV } from "../lib/nav";
import { ROLE_LABELS } from "../lib/types";

export function Sidebar() {
  const { profile } = useAuth();
  if (!profile) return null;
  const items = NAV[profile.role];

  return (
    <div
      style={{
        width: 250,
        flex: "none",
        background: "var(--surface)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        padding: "22px 16px",
        position: "sticky",
        top: 0,
        height: "100svh",
      }}
    >
      <div style={{ font: "800 20px var(--font-body)", letterSpacing: "-.01em", padding: "0 8px 4px" }}>BIZQWIK</div>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", padding: "0 8px 20px" }}>
        {ROLE_LABELS[profile.role].toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((t) => (
          <NavLink key={t.key} to={t.path} end={t.path === "/"} style={{ textDecoration: "none" }}>
            {({ isActive }) => (
              <div
                data-sq
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 12px",
                  borderRadius: "var(--r-tile)",
                  cursor: "pointer",
                  background: isActive ? "var(--primary-tint)" : "transparent",
                  color: isActive ? "var(--primary-pressed)" : "var(--ink-muted)",
                  font: "600 16px var(--font-body)",
                }}
              >
                <Icon name={t.icon} size={19} />
                {t.label}
              </div>
            )}
          </NavLink>
        ))}
      </div>
      <NavLink to="/account" style={{ marginTop: "auto", textDecoration: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 0", borderTop: "1px solid var(--line)" }}>
          <Avatar name={profile.name} size={34} />
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "600 16px var(--font-body)", lineHeight: 1.1, color: "var(--ink)" }}>{profile.name}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", display: "flex", alignItems: "center", gap: 4 }}>
              Account <Icon name="chevron-right" size={13} />
            </div>
          </div>
        </div>
      </NavLink>
    </div>
  );
}

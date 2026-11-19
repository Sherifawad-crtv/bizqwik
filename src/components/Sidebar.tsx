import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { useAuth } from "../lib/auth";
import { navFor, type NavItem } from "../lib/nav";
import { ROLE_LABELS } from "../lib/types";
import { QUICK_MS, tr } from "../lib/motion";

function SidebarItem({ item }: { item: NavItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <NavLink to={item.path} end={item.path === "/"} style={{ textDecoration: "none" }} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {({ isActive }) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 12px",
            borderRadius: "var(--radius-item)",
            cursor: "pointer",
            background: isActive ? "var(--color-bg-fill-accent-default)" : hovered ? "var(--color-bg-surface-secondary-default)" : "transparent",
            color: isActive ? "var(--color-bg-fill-primary-active)" : hovered ? "var(--color-text-primary-default)" : "var(--color-text-secondary-default)",
            font: "600 var(--text-callout-size) var(--font-family-body)",
            transition: tr(["background", "color"], QUICK_MS),
          }}
        >
          <Icon name={item.icon} size={19} solid={isActive} />
          {item.label}
        </div>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { profile, orgMode } = useAuth();
  if (!profile) return null;
  const items = navFor(profile.role, orgMode);

  return (
    <div
      style={{
        width: 250,
        flex: "none",
        background: "var(--color-bg-surface-primary-default)",
        borderRight: "1px solid var(--color-border-primary-default)",
        display: "flex",
        flexDirection: "column",
        padding: "22px 16px",
        position: "sticky",
        top: 0,
        height: "100svh",
      }}
    >
      <img src="/wordmark.png" alt="Bizqwik" style={{ height: 24, width: "auto", alignSelf: "flex-start", margin: "0 8px 12px", display: "block" }} />
      <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", padding: "0 8px 20px" }}>
        {ROLE_LABELS[profile.role].toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((t) => (
          <SidebarItem key={t.key} item={t} />
        ))}
      </div>
      <NavLink to="/account" style={{ marginTop: "auto", textDecoration: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 8px 0", borderTop: "1px solid var(--color-border-primary-default)" }}>
          <Avatar name={profile.name} size={34} src={profile.avatarUrl} />
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "600 var(--text-callout-size) var(--font-family-body)", lineHeight: 1.1, color: "var(--color-text-primary-default)" }}>{profile.name}</div>
            <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", display: "flex", alignItems: "center", gap: 4 }}>
              Account <Icon name="chevron-right" size={13} />
            </div>
          </div>
        </div>
      </NavLink>
    </div>
  );
}

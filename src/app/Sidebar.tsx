import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Avatar } from "../design-system/components/Avatar";
import { Icon } from "../design-system/components/Icon";
import { useAuth } from "../shared/auth";
import { navFor, type NavItem } from "../shared/screen/nav";
import { ROLE_LABELS } from "../shared/types";
import { QUICK_MS, tr } from "../design-system/motion/motion";
import "./Sidebar.css";

function SidebarItem({ item }: { item: NavItem }) {
  const [hovered, setHovered] = useState(false);
  return (
    <NavLink className="bq-sidebar-item-part" to={item.path} end={item.path === "/"} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {({ isActive }) => (
        <div className="bq-sidebar-item-text"
          style={{ background: isActive ? "var(--color-bg-fill-accent-default)" : hovered ? "var(--color-bg-surface-secondary-default)" : "transparent", color: isActive ? "var(--color-bg-fill-primary-active)" : hovered ? "var(--color-text-primary-default)" : "var(--color-text-secondary-default)", transition: tr(["background", "color"], QUICK_MS) }}
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
    <div className="bq-sidebar-stack"
    >
      <img className="bq-sidebar-img" src="/wordmark.png" alt="Bizqwik" />
      <div className="bq-sidebar-label">
        {ROLE_LABELS[profile.role].toUpperCase()}
      </div>
      <div className="bq-flex bq-col bq-gap-1">
        {items.map((t) => (
          <SidebarItem key={t.key} item={t} />
        ))}
      </div>
      <NavLink className="bq-sidebar-part" to="/account">
        <div className="bq-sidebar-row">
          <Avatar name={profile.name} size={34} src={profile.avatarUrl} />
          <div className="bq-min-w-0">
            <div className="bq-sidebar-text">{profile.name}</div>
            <div className="bq-sidebar-meta">
              Account <Icon name="chevron-right" size={13} />
            </div>
          </div>
        </div>
      </NavLink>
    </div>
  );
}

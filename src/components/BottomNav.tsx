import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";
import type { NavItem } from "../lib/nav";

export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <div
      style={{
        flex: "0 1 auto",
        minWidth: 0,
        height: 64,
        borderRadius: 999,
        background: "rgba(251,250,247,.55)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid rgba(255,255,255,.55)",
        boxShadow: "var(--shadow-float), inset 0 1px 0 rgba(255,255,255,.7)",
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "0 6px",
      }}
    >
      {items.map((t) => (
        <NavLink
          key={t.key}
          to={t.path}
          end={t.path === "/"}
          title={t.label}
          aria-label={t.label}
          data-tap
          style={{ flex: "none", width: 52, height: 52, background: "none", border: 0, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {({ isActive }) => (
            <span
              style={{
                width: 52,
                height: 52,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive ? "var(--primary-tint-strong)" : "transparent",
                color: isActive ? "var(--primary-pressed)" : "var(--ink-muted)",
                transition: "background-color .2s ease, color .2s ease",
              }}
            >
              <Icon name={t.icon} />
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import type { NavItem } from "../lib/nav";

const ITEM = 52;
const GAP = 2;
const PAD = 6;

export function BottomNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const activeIndex = items.findIndex((t) => (t.path === "/" ? pathname === "/" : pathname.startsWith(t.path)));

  return (
    <div
      style={{
        position: "relative",
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
        gap: GAP,
        padding: `0 ${PAD}px`,
      }}
    >
      {activeIndex >= 0 && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: PAD,
            top: (64 - ITEM) / 2,
            width: ITEM,
            height: ITEM,
            borderRadius: 999,
            background: "var(--primary-tint-strong)",
            transform: `translateX(${activeIndex * (ITEM + GAP)}px)`,
            transition: "transform .32s cubic-bezier(.22,1,.36,1)",
          }}
        />
      )}
      {items.map((t) => (
        <NavLink
          key={t.key}
          to={t.path}
          end={t.path === "/"}
          title={t.label}
          aria-label={t.label}
          data-tap
          style={{ position: "relative", zIndex: 1, flex: "none", width: ITEM, height: ITEM, background: "none", border: 0, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {({ isActive }) => (
            <span
              style={{
                width: ITEM,
                height: ITEM,
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isActive ? "var(--primary-pressed)" : "var(--ink-muted)",
                transition: "color .2s ease",
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

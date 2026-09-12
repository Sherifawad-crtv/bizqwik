import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import { matchTabIndex, type NavItem } from "../lib/nav";

const ITEM = 52;
const GAP = 6;
const PAD = 6;
// Real hit area extends past the visible ITEM box using space that already
// exists but is otherwise unused: the bar's own vertical padding (64px bar,
// 52px icon), and half the gap on each side horizontally (so two adjacent
// items' hit zones meet exactly at the gap's midpoint — full coverage,
// no overlap). Purely invisible; the icons themselves never change size.
const HIT_SLOP_Y = (64 - ITEM) / 2;
const HIT_SLOP_X = GAP / 2;

export function BottomNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const activeIndex = matchTabIndex(pathname, items);

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
        overflow: "hidden",
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
            <>
              <span aria-hidden style={{ position: "absolute", inset: `${-HIT_SLOP_Y}px ${-HIT_SLOP_X}px` }} />
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
                <Icon name={t.icon} solid={isActive} />
              </span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

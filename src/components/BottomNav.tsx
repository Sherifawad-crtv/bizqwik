import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import { matchTabIndex, type NavItem } from "../lib/nav";

const ITEM = 44;
const GAP = 5;
const PAD = 5;
const BAR_BORDER = 1;
// The active-tab highlight keeps its original size (and so its ratio to the
// 64px bar) even though ITEM shrank to fit narrow phones — it's centered on
// the (now smaller) icon box rather than sized to match it, so the "blob"
// stays as prominent as it always was.
const INDICATOR = 52;
// Real hit area extends past the visible ITEM box using space that already
// exists but is otherwise unused: the bar's own vertical padding (64px bar,
// 44px icon), and half the gap on each side horizontally (so two adjacent
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
            left: PAD + ITEM / 2 - INDICATOR / 2,
            // The bar's own 1px border isn't part of the flex content box the
            // icon is actually centered within, so it has to be subtracted
            // here too — otherwise the indicator centers on the bar's outer
            // edge instead of the icon, landing 1px off (uneven top/bottom
            // padding) even though the equivalent horizontal math is exact.
            top: (64 - BAR_BORDER * 2 - INDICATOR) / 2,
            width: INDICATOR,
            height: INDICATOR,
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

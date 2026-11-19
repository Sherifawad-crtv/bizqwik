import { NavLink, useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import { matchTabIndex, type NavItem } from "../lib/nav";
import { useIsNarrowPhone } from "../lib/useIsMobile";
import { noteTabTap } from "../lib/tabTap";
import { CONTROL_MS, QUICK_MS, tr } from "../lib/motion";

const BAR_BORDER = 1;

// Sizes: the icon circle (ITEM), the gap around it (PAD) and between circles (GAP).
// The bar is exactly ITEM + 2 × (PAD + border) tall, so it hugs its contents evenly.
const REGULAR = { ITEM: 50, GAP: 6, PAD: 6 };
// Phones too narrow for 5 tabs beside the + button (see useIsNarrowPhone) get
// a slightly smaller circle and a gap of 7, which keeps the bar 64px tall.
const COMPACT = { ITEM: 48, GAP: 4, PAD: 7 };

export function BottomNav({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const activeIndex = matchTabIndex(pathname, items);
  const narrow = useIsNarrowPhone();
  const { ITEM, GAP, PAD } = narrow ? COMPACT : REGULAR;
  // The bar hugs its contents with the same gap on every side, and its corner is
  // the active circle's radius plus that gap: outer = inner + padding (26 + 6 = 32).
  const INDICATOR = ITEM;
  const BAR_H = ITEM + 2 * (PAD + BAR_BORDER);
  // Real hit area extends past the visible ITEM box using space that already
  // exists but is otherwise unused: the bar's own vertical padding (64px bar
  // minus ITEM), and half the gap on each side horizontally (so two adjacent
  // items' hit zones meet exactly at the gap's midpoint — full coverage,
  // no overlap). Purely invisible; the icons themselves never change size.
  const HIT_SLOP_Y = (BAR_H - ITEM) / 2;
  const HIT_SLOP_X = GAP / 2;

  return (
    <div
      style={{
        position: "relative",
        flex: "0 1 auto",
        minWidth: 0,
        height: BAR_H,
        borderRadius: ITEM / 2 + PAD + BAR_BORDER,
        background: "var(--color-bg-surface-glass-default)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: "1px solid var(--color-border-glass-default)",
        boxShadow: "var(--shadow-float), var(--shadow-glass-highlight)",
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
            top: PAD,
            width: INDICATOR,
            height: INDICATOR,
            borderRadius: 999,
            background: "var(--color-bg-fill-accent-selected)",
            transform: `translateX(${activeIndex * (ITEM + GAP)}px)`,
            transition: tr("transform", CONTROL_MS),
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
          className="bq-scale"
          onClick={noteTabTap}
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
                  color: isActive ? "var(--color-bg-fill-primary-active)" : "var(--color-text-secondary-default)",
                  transition: tr("color", QUICK_MS),
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

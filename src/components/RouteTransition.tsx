import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { matchTabIndex, headerMode, type NavItem } from "../lib/nav";
import type { Role } from "../lib/types";

/** How many levels deep a route sits, for push-transition purposes: 0 is a
 * tab-level route (switched via tab-slide); 1+ is reached by drilling in
 * from a shallower route, one level at a time — direction is decided by
 * comparing depth, not just "is this a push route", so a route that's
 * itself a push destination (e.g. /account) can still have its own deeper
 * children (/account/profile) without the two directions flipping. */
function pushDepth(pathname: string): number {
  if (pathname === "/account/profile" || pathname === "/account/password") return 2;
  if (pathname === "/account" || pathname === "/classes" || pathname === "/activity" || /^\/coaches\/[^/]+$/.test(pathname)) return 1;
  return 0;
}

interface Layer {
  pathname: string;
  outlet: ReactNode;
  kind: "tab" | "push";
  index: number; // tab position, -1 for push routes
  depth: number;
}

type Anim = { type: "none" } | { type: "push-in" | "push-out" } | { type: "tab-slide"; dir: 1 | -1 };

const PUSH_MS = 340;
const PUSH_EASE = "cubic-bezier(.32,.72,0,1)";
// Same duration/easing as the bottom nav's sliding pill (BottomNav.tsx), so
// the content and the pill read as one connected motion.
const TAB_MS = 320;
const TAB_EASE = "cubic-bezier(.22,1,.36,1)";

// Bottom clearance for the fixed bottom-nav bar (BottomNav.tsx: 64px icons +
// 12px padding = ~76px real footprint) needs real headroom beyond that, not
// just enough to clear it at rest: iOS Safari's toolbar (address bar, often
// bottom-positioned since iOS 15) collapses/expands as you scroll, which
// can shift the fixed nav bar by 80-100px relative to already-scrolled
// content — on a small screen that's most of a tight margin, and the last
// row of a list can end up at the same screen position as the nav icons,
// so a tap meant for the nav registers on the row underneath instead.
// Top padding clears the fixed top chrome (Shell.tsx) — the home screen has
// none at all (just breathing room below the safe area), everything else
// gets the thin centered-title row's real height.
function layerStyle(pathname: string, role: Role): CSSProperties {
  const top = headerMode(pathname, role) === "home" ? 20 : 80;
  return {
    position: "absolute",
    inset: 0,
    padding: `calc(${top}px + var(--safe-top)) 16px calc(230px + var(--safe-bottom))`,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    background: "var(--paper)",
  };
}

export function RouteTransition({ tabs, role }: { tabs: NavItem[]; role: Role }) {
  const location = useLocation();
  const outlet = useOutlet();

  const makeLayer = (pathname: string, node: ReactNode): Layer => {
    const depth = pushDepth(pathname);
    return depth > 0
      ? { pathname, outlet: node, kind: "push", index: -1, depth }
      : { pathname, outlet: node, kind: "tab", index: matchTabIndex(pathname, tabs), depth: 0 };
  };

  const [current, setCurrent] = useState<Layer>(() => makeLayer(location.pathname, outlet));
  const [previous, setPrevious] = useState<Layer | null>(null);
  const [anim, setAnim] = useState<Anim>({ type: "none" });
  const [entered, setEntered] = useState(false);

  const timer = useRef<number | undefined>(undefined);
  const frame1 = useRef<number | undefined>(undefined);
  const frame2 = useRef<number | undefined>(undefined);

  useEffect(() => {
    const path = location.pathname;

    if (path === current.pathname) {
      setCurrent(makeLayer(path, outlet));
      return;
    }

    const next = makeLayer(path, outlet);
    let nextAnim: Anim;
    if (next.depth === 0 && current.depth === 0) {
      nextAnim = { type: "tab-slide", dir: next.index >= current.index ? 1 : -1 };
    } else if (next.depth > current.depth) {
      nextAnim = { type: "push-in" };
    } else if (next.depth < current.depth) {
      nextAnim = { type: "push-out" };
    } else {
      // Same nonzero depth, different route — a lateral move between two
      // push destinations. Not reachable through this app's UI today (every
      // push route is left via its own "‹ back" link, one level at a time),
      // but push-in is the sane default if it ever is.
      nextAnim = { type: "push-in" };
    }

    setPrevious(current);
    setCurrent(next);
    setAnim(nextAnim);
    setEntered(false);

    cancelAnimationFrame(frame1.current!);
    cancelAnimationFrame(frame2.current!);
    frame1.current = requestAnimationFrame(() => {
      frame2.current = requestAnimationFrame(() => setEntered(true));
    });

    clearTimeout(timer.current);
    const duration = nextAnim.type === "tab-slide" ? TAB_MS : PUSH_MS;
    timer.current = window.setTimeout(() => {
      setPrevious(null);
      setAnim({ type: "none" });
    }, duration);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      cancelAnimationFrame(frame1.current!);
      cancelAnimationFrame(frame2.current!);
    },
    [],
  );

  if (!previous) {
    return (
      <div data-scroll style={layerStyle(current.pathname, role)}>
        {current.outlet}
      </div>
    );
  }

  switch (anim.type) {
    case "none":
      return (
        <div data-scroll style={layerStyle(current.pathname, role)}>
          {current.outlet}
        </div>
      );

    case "push-in":
    case "push-out": {
      const overLayer = anim.type === "push-in" ? current : previous;
      const underLayer = anim.type === "push-in" ? previous : current;
      const overShown = anim.type === "push-in" ? entered : !entered;
      return (
        <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          <div data-scroll style={layerStyle(underLayer.pathname, role)}>
            {underLayer.outlet}
          </div>
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,.14)",
              opacity: overShown ? 1 : 0,
              transition: `opacity ${PUSH_MS}ms ${PUSH_EASE}`,
              pointerEvents: "none",
            }}
          />
          <div
            data-scroll
            style={{
              ...layerStyle(overLayer.pathname, role),
              boxShadow: overShown ? "-8px 0 24px rgba(0,0,0,.12)" : "none",
              transform: overShown ? "translateX(0)" : "translateX(100%)",
              transition: `transform ${PUSH_MS}ms ${PUSH_EASE}`,
            }}
          >
            {overLayer.outlet}
          </div>
        </div>
      );
    }

    case "tab-slide": {
      const dir = anim.dir;
      return (
        <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          <div
            data-scroll
            style={{
              ...layerStyle(previous.pathname, role),
              transform: entered ? `translateX(${-dir * 100}%)` : "translateX(0)",
              transition: `transform ${TAB_MS}ms ${TAB_EASE}`,
            }}
          >
            {previous.outlet}
          </div>
          <div
            data-scroll
            style={{
              ...layerStyle(current.pathname, role),
              transform: entered ? "translateX(0)" : `translateX(${dir * 100}%)`,
              transition: `transform ${TAB_MS}ms ${TAB_EASE}`,
            }}
          >
            {current.outlet}
          </div>
        </div>
      );
    }
  }
}

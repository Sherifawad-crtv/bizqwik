import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { matchTabIndex, type NavItem } from "../lib/nav";

/** Routes reached by drilling in from a tab, not by switching tabs. */
function isPushRoute(pathname: string): boolean {
  return pathname === "/account" || /^\/coaches\/[^/]+$/.test(pathname);
}

interface Layer {
  pathname: string;
  outlet: ReactNode;
  kind: "tab" | "push";
  index: number; // tab position, -1 for push routes
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
const layerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  padding: "calc(86px + var(--safe-top)) 16px calc(230px + var(--safe-bottom))",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  background: "var(--paper)",
};

export function RouteTransition({ tabs }: { tabs: NavItem[] }) {
  const location = useLocation();
  const outlet = useOutlet();

  const makeLayer = (pathname: string, node: ReactNode): Layer =>
    isPushRoute(pathname)
      ? { pathname, outlet: node, kind: "push", index: -1 }
      : { pathname, outlet: node, kind: "tab", index: matchTabIndex(pathname, tabs) };

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
    if (next.kind === "push") nextAnim = { type: "push-in" };
    else if (current.kind === "push") nextAnim = { type: "push-out" };
    else nextAnim = { type: "tab-slide", dir: next.index >= current.index ? 1 : -1 };

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
      <div data-scroll style={layerStyle}>
        {current.outlet}
      </div>
    );
  }

  switch (anim.type) {
    case "none":
      return (
        <div data-scroll style={layerStyle}>
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
          <div data-scroll style={layerStyle}>
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
              ...layerStyle,
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
              ...layerStyle,
              transform: entered ? `translateX(${-dir * 100}%)` : "translateX(0)",
              transition: `transform ${TAB_MS}ms ${TAB_EASE}`,
            }}
          >
            {previous.outlet}
          </div>
          <div
            data-scroll
            style={{
              ...layerStyle,
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

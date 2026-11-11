import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { Suspense } from "react";
import { Spinner } from "./Spinner";
import { matchTabIndex, headerMode, type NavItem, type OrgMode } from "../lib/nav";
import { isStandalone } from "../lib/push";
import type { Role } from "../lib/types";
import { EASE, FADE_MS, PUSH_MS } from "../lib/motion";

/** How the app moves between screens, the way iOS does it:
 *  - the sections in the tab bar are peers: switching between them is a quick
 *    fade, never a slide;
 *  - anything else is a level deeper than where you came from (a coach's page,
 *    a payee, Accounting, Team & tiers, Sessions, Activity, Account), and going
 *    in slides in from the right, going back slides away to the right;
 *  - settings go one level further (Account, then Profile or Password).
 * One rule for every screen, so similar moves always feel alike. */
function pushDepth(pathname: string, tabs: NavItem[]): number {
  if (pathname === "/account/profile" || pathname === "/account/password") return 2;
  if (pathname === "/" || tabs.some((t) => t.path === pathname)) return 0;
  return 1;
}

// Tapping a tab is a switch between peers, even when you were a level deep
// (it must not play a "back" slide), so the bar says so just before navigating.
let lastTabTap = 0;
export function noteTabTap() {
  lastTabTap = Date.now();
}

interface Layer {
  pathname: string;
  outlet: ReactNode;
  kind: "tab" | "push";
  index: number; // tab position, -1 for push routes
  depth: number;
}

type Anim = { type: "none" } | { type: "push-in" | "push-out" } | { type: "tab-slide"; dir: 1 | -1 };

const PUSH_EASE = EASE;
// Switching tabs is the most frequent thing people do, so the content just
// fades in under the bar's sliding pill — no travel to wait for.
const TAB_MS = FADE_MS;

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
//
// That headroom is only needed in a browser tab. Installed as an app there is
// no toolbar, so the page ends just below the bar and you can't scroll into
// blank space.
const BOTTOM_CLEARANCE = isStandalone() ? 112 : 160;
function layerStyle(pathname: string, role: Role, mode: OrgMode): CSSProperties {
  const top = headerMode(pathname, role, mode) === "home" ? 20 : 80;
  return {
    position: "absolute",
    inset: 0,
    padding: `calc(${top}px + var(--safe-top)) 16px calc(${BOTTOM_CLEARANCE}px + var(--safe-bottom))`,
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    background: "var(--paper)",
  };
}

export function RouteTransition({ tabs, role, orgMode = "team" }: { tabs: NavItem[]; role: Role; orgMode?: OrgMode }) {
  const location = useLocation();
  const rawOutlet = useOutlet();
  const outlet = <Suspense fallback={<Spinner />}>{rawOutlet}</Suspense>;

  const makeLayer = (pathname: string, node: ReactNode): Layer => {
    const depth = pushDepth(pathname, tabs);
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
    if ((next.depth === 0 && current.depth === 0) || Date.now() - lastTabTap < 700) {
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

  // Resting, and during a tab switch, the screen is always the same element
  // tree (a stage holding the current layer, plus the old one while it fades
  // under). If it were rebuilt when the fade ends, anything just opened on the
  // screen would be reset.
  if (!previous || anim.type === "none" || anim.type === "tab-slide") {
    const fading = !!previous && anim.type === "tab-slide";
    return (
      <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
        {fading && (
          <div key="prev" data-scroll aria-hidden style={{ ...layerStyle(previous.pathname, role, orgMode), pointerEvents: "none" }}>
            {previous.outlet}
          </div>
        )}
        <div
          key="cur"
          data-scroll
          style={{
            ...layerStyle(current.pathname, role, orgMode),
            opacity: fading && !entered ? 0 : 1,
            transition: fading ? `opacity ${TAB_MS}ms ease-out` : undefined,
          }}
        >
          {current.outlet}
        </div>
      </div>
    );
  }

  switch (anim.type) {
    case "push-in":
    case "push-out": {
      const overLayer = anim.type === "push-in" ? current : previous;
      const underLayer = anim.type === "push-in" ? previous : current;
      const overShown = anim.type === "push-in" ? entered : !entered;
      return (
        <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
          <div
            data-scroll
            style={{
              ...layerStyle(underLayer.pathname, role, orgMode),
              // The screen underneath eases back a little as the new one covers it (and returns as it leaves), like iOS.
              transform: overShown ? "translateX(-28%)" : "translateX(0)",
              transition: `transform ${PUSH_MS}ms ${PUSH_EASE}`,
            }}
          >
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
              ...layerStyle(overLayer.pathname, role, orgMode),
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

  }
}

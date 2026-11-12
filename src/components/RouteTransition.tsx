import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { Suspense } from "react";
import { Spinner } from "./Spinner";
import { matchTabIndex, headerMode, type NavItem, type OrgMode } from "../lib/nav";
import { isStandalone } from "../lib/push";
import type { Role } from "../lib/types";
import { EASE, FADE_MS, PUSH_MS } from "../lib/motion";
import { ScreenActive } from "../lib/screenActive";
import { waitForFirstScreen } from "../lib/useAsync";
import { reportScreenReady } from "../lib/vitals";

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

let layerIds = 0;

interface Layer {
  /** Stable for the life of a screen: it is the React key, so a screen is never
   * rebuilt when it changes role (arriving, resting, sliding away, kept below). */
  id: number;
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

// How many screens stay alive underneath the one you're on (so going back is
// instant, with your place kept, instead of rebuilding the screen).
const KEEP = 2;

export function RouteTransition({ tabs, role, orgMode = "team" }: { tabs: NavItem[]; role: Role; orgMode?: OrgMode }) {
  const location = useLocation();
  const rawOutlet = useOutlet();
  const outlet = <Suspense fallback={<Spinner />}>{rawOutlet}</Suspense>;

  const makeLayer = (pathname: string, node: ReactNode): Layer => {
    const depth = pushDepth(pathname, tabs);
    return depth > 0
      ? { id: ++layerIds, pathname, outlet: node, kind: "push", index: -1, depth }
      : { id: ++layerIds, pathname, outlet: node, kind: "tab", index: matchTabIndex(pathname, tabs), depth: 0 };
  };

  const [current, setCurrent] = useState<Layer>(() => makeLayer(location.pathname, outlet));
  const [previous, setPrevious] = useState<Layer | null>(null);
  // Screens kept alive (hidden) beneath the current one, shallowest first.
  const [kept, setKept] = useState<Layer[]>([]);
  const [anim, setAnim] = useState<Anim>({ type: "none" });
  const [entered, setEntered] = useState(false);

  const timer = useRef<number | undefined>(undefined);
  const frame1 = useRef<number | undefined>(undefined);
  const frame2 = useRef<number | undefined>(undefined);

  // How long each screen takes from the tap to its data being on screen.
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    const t0 = performance.now();
    const path = location.pathname;
    let alive = true;
    waitForFirstScreen(10000, 800).then(() => alive && reportScreenReady(path, performance.now() - t0));
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const path = location.pathname;

    if (path === current.pathname) {
      setCurrent((c) => ({ ...c, outlet })); // same screen, new content: keep it mounted
      return;
    }

    const depth = pushDepth(path, tabs);
    const viaTab = Date.now() - lastTabTap < 700;
    let next: Layer;
    let nextKept: Layer[] = kept;
    let nextAnim: Anim;

    if (viaTab || (depth === 0 && current.depth === 0)) {
      // peers (tabs): a fade; whatever was kept under the old section is let go
      next = makeLayer(path, outlet);
      nextKept = [];
      nextAnim = { type: "tab-slide", dir: next.index >= current.index ? 1 : -1 };
    } else if (depth > current.depth) {
      // going deeper: the screen you leave stays alive underneath
      next = makeLayer(path, outlet);
      nextKept = [...kept, current].slice(-KEEP);
      nextAnim = { type: "push-in" };
    } else if (depth < current.depth) {
      // going back: reveal the screen that was kept, exactly as you left it
      const at = kept.map((l) => l.pathname).lastIndexOf(path);
      if (at >= 0) {
        next = { ...kept[at], outlet };
        nextKept = kept.slice(0, at);
      } else {
        next = makeLayer(path, outlet);
        nextKept = [];
      }
      nextAnim = { type: "push-out" };
    } else {
      // sideways between two deeper screens
      next = makeLayer(path, outlet);
      nextAnim = { type: "push-in" };
    }

    setPrevious(current);
    setCurrent(next);
    setKept(nextKept);
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

  // Every screen is one stable element (keyed by its id) whatever it is doing,
  // so nothing is torn down and rebuilt when a slide starts or ends.
  const moving = !!previous && anim.type !== "none";
  const pushIn = moving && anim.type === "push-in";
  const pushOut = moving && anim.type === "push-out";
  const fading = moving && anim.type === "tab-slide";

  const styleFor = (l: Layer): CSSProperties => {
    const base = layerStyle(l.pathname, role, orgMode);
    if (l.id === current.id) {
      if (fading) return { ...base, opacity: entered ? 1 : 0, transition: `opacity ${TAB_MS}ms ease-out`, willChange: "opacity" };
      if (pushIn) {
        return {
          ...base,
          boxShadow: entered ? "none" : "-8px 0 24px rgba(0,0,0,.12)",
          transform: entered ? "translate3d(0,0,0)" : "translate3d(100%,0,0)",
          transition: `transform ${PUSH_MS}ms ${PUSH_EASE}`,
          willChange: "transform",
        };
      }
      if (pushOut) {
        // the screen you are returning to eases back into place
        return { ...base, transform: entered ? "translate3d(0,0,0)" : "translate3d(-28%,0,0)", transition: `transform ${PUSH_MS}ms ${PUSH_EASE}`, willChange: "transform" };
      }
      return base;
    }
    if (previous && l.id === previous.id) {
      if (fading) return { ...base, pointerEvents: "none" };
      if (pushIn) {
        // the screen underneath eases back a little as the new one covers it, like iOS
        return { ...base, transform: entered ? "translate3d(-28%,0,0)" : "translate3d(0,0,0)", transition: `transform ${PUSH_MS}ms ${PUSH_EASE}`, willChange: "transform", pointerEvents: "none" };
      }
      if (pushOut) {
        return {
          ...base,
          boxShadow: entered ? "none" : "-8px 0 24px rgba(0,0,0,.12)",
          transform: entered ? "translate3d(100%,0,0)" : "translate3d(0,0,0)",
          transition: `transform ${PUSH_MS}ms ${PUSH_EASE}`,
          willChange: "transform",
          pointerEvents: "none",
        };
      }
    }
    // kept alive underneath: out of sight and out of reach, but not unmounted
    return { ...base, visibility: "hidden", pointerEvents: "none" };
  };

  // bottom to top
  const seen = new Set<number>();
  const order: Layer[] = [];
  const add = (l: Layer | null) => {
    if (l && !seen.has(l.id)) {
      seen.add(l.id);
      order.push(l);
    }
  };
  kept.forEach(add);
  if (pushOut) {
    add(current); // under
    add(previous); // over, leaving
  } else {
    add(previous);
    add(current);
  }

  const topId = pushIn ? current.id : pushOut ? previous!.id : -1;
  const children: ReactNode[] = [];
  for (const l of order) {
    if (l.id === topId) {
      children.push(
        <div
          key="dim"
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,.14)",
            // dims the screen underneath as the new one covers it (and lifts as it leaves)
            opacity: pushIn ? (entered ? 1 : 0) : entered ? 0 : 1,
            transition: `opacity ${PUSH_MS}ms ${PUSH_EASE}`,
            pointerEvents: "none",
          }}
        />,
      );
    }
    const isHidden = l.id !== current.id && !(previous && l.id === previous.id);
    children.push(
      <div key={l.id} data-scroll aria-hidden={isHidden || undefined} inert={isHidden} style={styleFor(l)}>
        <ScreenActive.Provider value={l.id === current.id}>{l.outlet}</ScreenActive.Provider>
      </div>,
    );
  }

  return <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>{children}</div>;
}

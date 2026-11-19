import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "../design-system/components/Spinner";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { RouteTransition } from "./RouteTransition";
import { PullToRefresh } from "./PullToRefresh";
import { Sidebar } from "./Sidebar";
import { Fab } from "./Fab";
import { Icon } from "../design-system/components/Icon";
import { useAuth } from "../shared/auth";
import { useHeader } from "../shared/screen/header";
import { useIsMobile, useIsNarrowPhone } from "../design-system/hooks/useIsMobile";
import { LocationsProvider } from "../shared/locations";
import { EASE, FADE_MS, QUICK_MS, tr } from "../design-system/motion/motion";
import { navFor, headerMode, accountBackTarget, isSoloOwner, isSubPage, homePathForRole } from "../shared/screen/nav";

// The Back button and the empty slot opposite it are the same width, so the title stays centred.
const BACK_W = 84;
import { usePublishedActions, usePublishedBack } from "../shared/screen/floatingActions";
import { useLatch } from "../shared/useLatch";
import "./Shell.css";

/** The top pill with the screen's title. When the title changes, the old words
 * fade out as the new ones fade in (stacked), and the pill eases to the new
 * width instead of snapping. */
function TitlePill({ title }: { title: string }) {
  const [st, setSt] = useState({ shown: title, leaving: null as string | null });
  // Derived while rendering (no effect hop), so it switches in the same frame.
  if (title !== st.shown) setSt({ shown: title, leaving: st.shown });
  useEffect(() => {
    if (st.leaving === null) return;
    const id = window.setTimeout(() => setSt((s) => ({ ...s, leaving: null })), FADE_MS + 30);
    return () => window.clearTimeout(id);
  }, [st.shown, st.leaving]);

  const sizer = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (sizer.current) setWidth(Math.ceil(sizer.current.getBoundingClientRect().width) + 36);
  }, [st.shown]);

  const cell = { gridArea: "1 / 1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as const;
  return (
    <div className="bq-shell-title-pill" data-testid="title-pill"
      style={{ width: width ?? undefined, transition: width !== null ? tr("width", QUICK_MS) : undefined }}
    >
      <span className="bq-shell-title-pill-layer" ref={sizer} aria-hidden>{st.shown}</span>
      {st.leaving !== null && (
        <span key={`out-${st.leaving}`} aria-hidden style={{ ...cell, animation: `bqFadeOut ${QUICK_MS}ms ${EASE} forwards` }}>{st.leaving}</span>
      )}
      <span key={st.shown} style={{ ...cell, animation: st.leaving !== null ? `bqFade ${QUICK_MS}ms ${EASE} both` : undefined }}>{st.shown}</span>
    </div>
  );
}

function ShellInner() {
  const { profile, orgMode } = useAuth();
  const isMobile = useIsMobile();
  const narrow = useIsNarrowPhone();
  const header = useHeader();
  const published = usePublishedActions();
  const publishedBack = usePublishedBack();
  const location = useLocation();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // The title bar appears only once the screen you're going to has published
  // its own title; until then (coming from a home screen, which has none) it
  // stays hidden rather than flashing the previous screen's title.
  const wantBar = !!profile && headerMode(pathname, profile.role, orgMode) !== "home";
  const [barOn, setBarOn] = useState(false);
  // Each time the bar appears it is built fresh with the right title, so it
  // never crossfades from whatever the last screen was called.
  const [barEpoch, setBarEpoch] = useState(0);
  if (!wantBar && barOn) setBarOn(false);
  if (wantBar && !barOn && header.path === pathname) {
    setBarOn(true);
    setBarEpoch((e) => e + 1);
  }

  const sub = isSubPage(pathname, navFor(profile?.role ?? "coach", orgMode));
  // A sub-page's actions show in the bar; the last ones stay put while they fade out.
  const showActions = sub && !!published && published.path === pathname;
  const actionsNode = useLatch(showActions ? published!.node : null);
  if (!profile) return null;
  // Back: where the screen says it came from; for Account its parent; otherwise one step back.
  const goBack = () => {
    if (publishedBack && publishedBack.path === pathname) return publishedBack.fn();
    if (headerMode(pathname, profile.role, orgMode) === "account") return navigate(accountBackTarget(pathname, profile.role, orgMode));
    if (location.key !== "default") return navigate(-1);
    navigate(homePathForRole(profile.role, orgMode));
  };
  // Everyone but accountant and front desk gets a FAB — what it does depends
  // on role (Fab.tsx branches: dept_head gets the "Create" menu for the
  // catalog, coach/head_coach get "log a session"). Front desk's actions live on its
  // home screen's quick-action grid instead.
  const solo = isSoloOwner(profile.role, orgMode);
  const showFab = profile.role !== "accountant" && profile.role !== "front_desk";

  if (isMobile) {
    return (
      <div className="bq-shell-inner-box">
        {(
          <div className="bq-shell-titlebar" data-testid="title-bar"
            aria-hidden={!barOn}
            style={{ opacity: barOn ? 1 : 0, pointerEvents: barOn ? "auto" : "none", transition: barOn ? tr("opacity", QUICK_MS) : "none", visibility: barOn ? "visible" : "hidden" }}
          >
            <div className="bq-flex-none bq-flex" style={{ width: BACK_W }}>
              {sub && (
                <button
                  onClick={goBack}
                  aria-label="Back"
                  className="bq-hit bq-shell-inner-btn"
                >
                  <Icon name="chevron-left" size={18} />
                  Back
                </button>
              )}
            </div>
            <div className="bq-flex-1 bq-min-w-0 bq-flex bq-justify-center">
              <TitlePill key={barEpoch} title={header.title} />
            </div>
            <div className="bq-flex-none" style={{ width: BACK_W }} />
          </div>
        )}

        <main className="bq-shell-inner-size">
          <PullToRefresh>
            <RouteTransition tabs={navFor(profile.role, orgMode)} role={profile.role} orgMode={orgMode} />
          </PullToRefresh>
        </main>

        {/* A soft fade under the bar so content slips away behind it instead of being cut. */}
        <div aria-hidden className="bq-bottom-fade" />
        {/* The bottom bar: the tab bar on tab screens, a sub-page's own actions on
            sub-pages. Both stay in one spot and hand over in one motion: the one
            leaving sinks and fades while the one arriving rises in. */}
        <div className="bq-shell-inner-layer" style={{ padding: `0 ${narrow ? 12 : 16}px var(--bar-bottom)` }}>
          <div className="bq-shell-inner-size-2">
            <div className="bq-barlayer" data-on={!showActions} aria-hidden={showActions || undefined} inert={showActions} style={{ gap: narrow ? 8 : 12 }}>
              <BottomNav items={navFor(profile.role, orgMode)} />
              {showFab && <Fab />}
            </div>
            <div className="bq-barlayer" data-on={showActions} aria-hidden={!showActions || undefined} inert={!showActions}>
              {actionsNode && (
                <div className="bq-grow bq-shell-inner-row-2">
                  {actionsNode}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bq-shell-inner-row-3">
      <Sidebar />
      {solo && (
        <div className="bq-shell-inner-layer-2">
          <Fab />
        </div>
      )}
      <div className="bq-grow">
        <div className="bq-shell-inner-row-4"
        >
          <div>
            <div className="bq-label">{header.kicker}</div>
            <div className="bq-stat-lg">{header.title}</div>
          </div>
          {header.right && <div className="bq-ml-auto">{header.right}</div>}
        </div>
        <div className="bq-shell-inner-spacing">
          <Suspense fallback={<Spinner />}><Outlet /></Suspense>
        </div>
      </div>
    </div>
  );
}

/** The app shell. Locations load here, once, so every screen has them already. */
export function Shell() {
  return (
    <LocationsProvider>
      <ShellInner />
    </LocationsProvider>
  );
}

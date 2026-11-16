import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Spinner } from "./Spinner";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { RouteTransition } from "./RouteTransition";
import { PullToRefresh } from "./PullToRefresh";
import { Sidebar } from "./Sidebar";
import { Fab } from "./Fab";
import { Icon } from "./Icon";
import { useAuth } from "../lib/auth";
import { useHeader } from "../lib/header";
import { useIsMobile, useIsNarrowPhone } from "../lib/useIsMobile";
import { LocationsProvider } from "../lib/locations";
import { FADE_MS } from "../lib/motion";
import { navFor, headerMode, accountBackTarget, isSoloOwner, isSubPage, homePathForRole } from "../lib/nav";

// The Back button and the empty slot opposite it are the same width, so the title stays centred.
const BACK_W = 84;
import { usePublishedActions, usePublishedBack } from "../lib/floatingActions";

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
    <div
      style={{
        position: "relative",
        maxWidth: "100%",
        width: width ?? undefined,
        boxSizing: "border-box",
        padding: "8px 18px",
        borderRadius: 999,
        background: "rgba(243,237,230,.82)",
        font: "800 17px var(--font-body)",
        letterSpacing: "-.01em",
        overflow: "hidden",
        display: "grid",
        justifyItems: "center",
        transition: width !== null ? `width ${FADE_MS}ms ease` : undefined,
      }}
    >
      <span ref={sizer} aria-hidden style={{ position: "absolute", visibility: "hidden", whiteSpace: "nowrap", pointerEvents: "none" }}>{st.shown}</span>
      {st.leaving !== null && (
        <span key={`out-${st.leaving}`} aria-hidden style={{ ...cell, animation: `bqFadeOut ${FADE_MS}ms ease forwards` }}>{st.leaving}</span>
      )}
      <span key={st.shown} style={{ ...cell, animation: st.leaving !== null ? `bqFade ${FADE_MS}ms ease both` : undefined }}>{st.shown}</span>
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
      <div style={{ minHeight: "100svh", background: "var(--paper)", position: "relative", overflow: "hidden" }}>
        {(
          <div
            aria-hidden={!barOn}
            style={{
              opacity: barOn ? 1 : 0,
              pointerEvents: barOn ? "auto" : "none",
              // Gone at once on the home screen (which has no title bar); only fades IN elsewhere.
              transition: barOn ? `opacity ${FADE_MS}ms ease` : "none",
              visibility: barOn ? "visible" : "hidden",
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              padding: "calc(14px + var(--safe-top)) 16px 10px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <div style={{ width: BACK_W, flex: "none", display: "flex" }}>
              {sub && (
                <button
                  onClick={goBack}
                  aria-label="Back"
                  className="bq-hit"
                  style={{ display: "flex", alignItems: "center", gap: 2, border: 0, cursor: "pointer", color: "var(--ink)", background: "rgba(243,237,230,.82)", borderRadius: 999, padding: "8px 14px 8px 8px", font: "700 var(--fs-body-sm) var(--font-body)" }}
                >
                  <Icon name="chevron-left" size={18} />
                  Back
                </button>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
              <TitlePill key={barEpoch} title={header.title} />
            </div>
            <div style={{ width: BACK_W, flex: "none" }} />
          </div>
        )}

        <main style={{ position: "relative", height: "100svh", overflow: "hidden" }}>
          <PullToRefresh>
            <RouteTransition tabs={navFor(profile.role, orgMode)} role={profile.role} orgMode={orgMode} />
          </PullToRefresh>
        </main>

        {/* A soft fade under the bar so content slips away behind it instead of being cut. */}
        <div aria-hidden className="bq-bottom-fade" />
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 55,
            // Sits just above the iOS home indicator, like a native tab bar.
            padding: `0 ${narrow ? 12 : 16}px var(--bar-bottom)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: narrow ? 8 : 12,
          }}
        >
          {sub ? (
            // A sub-page: no tab bar. Its main actions (if it has any) float here instead.
            published && published.path === pathname ? (
              <div key="actions" className="bq-grow" style={{ display: "flex", gap: 8, maxWidth: 520, padding: 8, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-float)", boxShadow: "var(--shadow-float)", animation: `bqRise ${FADE_MS + 90}ms var(--ease-standard) both` }}>
                {published.node}
              </div>
            ) : null
          ) : (
            <>
              <BottomNav items={navFor(profile.role, orgMode)} />
              {showFab && <Fab />}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100svh", background: "var(--paper)", display: "flex" }}>
      <Sidebar />
      {solo && (
        <div style={{ position: "fixed", right: 32, bottom: 32, zIndex: 40 }}>
          <Fab />
        </div>
      )}
      <div className="bq-grow">
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(243,237,230,.94)",
            borderBottom: "1px solid var(--line)",
            padding: "22px 30px 18px",
            display: "flex",
            alignItems: "flex-end",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="bq-label">{header.kicker}</div>
            <div style={{ font: "800 var(--fs-display)/1.1 var(--font-body)", letterSpacing: "-.02em" }}>{header.title}</div>
          </div>
          {header.right && <div style={{ marginLeft: "auto" }}>{header.right}</div>}
        </div>
        <div style={{ padding: "24px 30px 60px" }}>
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

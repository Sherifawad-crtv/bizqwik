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
import { navFor, headerMode, accountBackTarget, isSoloOwner } from "../lib/nav";

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
        background: "rgba(243,242,238,.82)",
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
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!profile) return null;
  // Everyone but accountant and front desk gets a FAB — what it does depends
  // on role (Fab.tsx branches: dept_head gets the "Create" menu for the
  // catalog, coach/head_coach get "log a session"). Front desk's actions live on its
  // home screen's quick-action grid instead.
  const solo = isSoloOwner(profile.role, orgMode);
  const showFab = profile.role !== "accountant" && profile.role !== "front_desk";

  if (isMobile) {
    const mode = headerMode(pathname, profile.role, orgMode);
    return (
      <div style={{ minHeight: "100svh", background: "var(--paper)", position: "relative", overflow: "hidden" }}>
        {(
          <div
            aria-hidden={mode === "home"}
            style={{
              opacity: mode === "home" ? 0 : 1,
              pointerEvents: mode === "home" ? "none" : "auto",
              transition: `opacity ${FADE_MS}ms ease`,
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
            <div style={{ width: 30, flex: "none", display: "flex" }}>
              {mode === "account" && (
                <button
                  onClick={() => navigate(accountBackTarget(pathname, profile.role, orgMode))}
                  aria-label="Back"
                  className="bq-hit"
                  style={{ border: 0, background: "none", padding: 7, margin: -7, cursor: "pointer", color: "var(--ink)", display: "flex" }}
                >
                  <Icon name="chevron-left" size={22} />
                </button>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
              <TitlePill title={header.title} />
            </div>
            <div style={{ width: 30, flex: "none" }} />
          </div>
        )}

        <main style={{ position: "relative", height: "100svh", overflow: "hidden" }}>
          <PullToRefresh>
            <RouteTransition tabs={navFor(profile.role, orgMode)} role={profile.role} orgMode={orgMode} />
          </PullToRefresh>
        </main>

        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 55,
            padding: `0 ${narrow ? 12 : 16}px calc(12px + var(--safe-bottom))`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: narrow ? 8 : 12,
          }}
        >
          <BottomNav items={navFor(profile.role, orgMode)} />
          {showFab && <Fab />}
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
            background: "rgba(243,242,238,.94)",
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
            <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>{header.title}</div>
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

import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { RouteTransition } from "./RouteTransition";
import { Sidebar } from "./Sidebar";
import { Fab } from "./Fab";
import { Icon } from "./Icon";
import { useAuth } from "../lib/auth";
import { useHeader } from "../lib/header";
import { useIsMobile, useIsNarrowPhone } from "../lib/useIsMobile";
import { NAV, headerMode, accountBackTarget } from "../lib/nav";

export function Shell() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const narrow = useIsNarrowPhone();
  const header = useHeader();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  if (!profile) return null;
  // Everyone but accountant gets a FAB — what it does depends on role
  // (Fab.tsx branches: dept_head gets the client wizard, coach/head_coach
  // get "log a session").
  const showFab = profile.role !== "accountant";

  if (isMobile) {
    const mode = headerMode(pathname, profile.role);
    return (
      <div style={{ minHeight: "100svh", background: "var(--paper)", position: "relative", overflow: "hidden" }}>
        {mode !== "home" && (
          <div
            style={{
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
                  onClick={() => navigate(accountBackTarget(pathname, profile.role))}
                  aria-label="Back"
                  style={{ border: 0, background: "none", padding: 4, margin: -4, cursor: "pointer", color: "var(--ink)", display: "flex" }}
                >
                  <Icon name="chevron-left" size={22} />
                </button>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
              <div
                style={{
                  maxWidth: "100%",
                  padding: "8px 18px",
                  borderRadius: 999,
                  background: "rgba(243,242,238,.65)",
                  backdropFilter: "blur(18px) saturate(180%)",
                  WebkitBackdropFilter: "blur(18px) saturate(180%)",
                  font: "800 17px var(--font-body)",
                  letterSpacing: "-.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {header.title}
              </div>
            </div>
            <div style={{ width: 30, flex: "none" }} />
          </div>
        )}

        <main style={{ position: "relative", height: "100svh", overflow: "hidden" }}>
          <RouteTransition tabs={NAV[profile.role]} role={profile.role} />
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
          <BottomNav items={NAV[profile.role]} />
          {showFab && <Fab />}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100svh", background: "var(--paper)", display: "flex" }}>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(243,242,238,.82)",
            backdropFilter: "blur(18px)",
            borderBottom: "1px solid var(--line)",
            padding: "22px 30px 18px",
            display: "flex",
            alignItems: "flex-end",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{header.kicker}</div>
            <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>{header.title}</div>
          </div>
          {header.right && <div style={{ marginLeft: "auto" }}>{header.right}</div>}
        </div>
        <div style={{ padding: "24px 30px 60px" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

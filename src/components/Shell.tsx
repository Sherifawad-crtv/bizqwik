import { Outlet, NavLink } from "react-router-dom";
import { Avatar } from "./Avatar";
import { BottomNav } from "./BottomNav";
import { RouteTransition } from "./RouteTransition";
import { Sidebar } from "./Sidebar";
import { Fab } from "./Fab";
import { useAuth } from "../lib/auth";
import { useHeader } from "../lib/header";
import { useIsMobile } from "../lib/useIsMobile";
import { NAV } from "../lib/nav";
import { canLog } from "../lib/types";

export function Shell() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const header = useHeader();

  if (!profile) return null;
  const showFab = canLog(profile.role);

  if (isMobile) {
    return (
      <div style={{ minHeight: "100svh", background: "var(--paper)", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: "rgba(251,250,247,.78)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--line)",
            padding: "calc(12px + var(--safe-top)) 18px 12px",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <NavLink to="/account" aria-label="Account">
            <Avatar name={profile.name} size={40} />
          </NavLink>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{header.kicker}</div>
            <div style={{ font: "800 20px/1.15 var(--font-body)", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {header.title}
            </div>
          </div>
          {header.right && <div style={{ marginLeft: "auto", flex: "none" }}>{header.right}</div>}
        </div>

        <main style={{ position: "relative", height: "100svh", overflow: "hidden" }}>
          <RouteTransition />
        </main>

        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 55,
            padding: "0 16px calc(12px + var(--safe-bottom))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
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
        <div style={{ padding: "24px 30px 60px", maxWidth: 1180 }}>
          <Outlet />
        </div>
      </div>
      {showFab && <Fab fixedDesktop />}
    </div>
  );
}

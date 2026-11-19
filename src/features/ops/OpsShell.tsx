import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../shared/auth";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { Icon, type IconName } from "../../design-system/components/Icon";
import { Avatar } from "../../design-system/components/Avatar";
import { BIZQWIK_ROLE_LABELS } from "../../shared/types";

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/bizqwik", label: "Overview", icon: "insights", end: true },
  { to: "/bizqwik/team", label: "Team", icon: "coaches" },
  { to: "/bizqwik/plans", label: "Plans", icon: "tag" },
];

function NavItem({ to, label, icon, end, onNavigate }: { to: string; label: string; icon: IconName; end?: boolean; onNavigate?: () => void }) {
  return (
    <NavLink to={to} end={end} onClick={onNavigate} style={{ textDecoration: "none" }}>
      {({ isActive }) => (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 12px",
            borderRadius: "var(--radius-item)",
            cursor: "pointer",
            background: isActive ? "var(--color-bg-fill-accent-default)" : "transparent",
            color: isActive ? "var(--color-bg-fill-primary-active)" : "var(--color-text-secondary-default)",
            font: "600 var(--text-callout-size) var(--font-family-body)",
          }}
        >
          <Icon name={icon} size={19} solid={isActive} />
          {label}
        </div>
      )}
    </NavLink>
  );
}

export function OpsShell() {
  const { bizqwikTeam, logout } = useAuth();
  const isMobile = useIsMobile();
  if (!bizqwikTeam) return null;

  if (isMobile) {
    return (
      <div style={{ minHeight: "100svh", background: "var(--color-bg-canvas-default)", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "var(--color-bg-surface-primary-default)",
            borderBottom: "1px solid var(--color-border-primary-default)",
            padding: "calc(12px + var(--safe-top)) 16px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/wordmark.png" alt="Bizqwik" style={{ height: 22, width: "auto", display: "block" }} />
            <span className="bq-label">OPS</span>
            <button
              onClick={logout}
              aria-label="Sign out"
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, border: 0, background: "none", color: "var(--color-text-tertiary-default)", cursor: "pointer", font: "700 var(--text-footnote-size) var(--font-family-body)" }}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 10, overflowX: "auto" }}>
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} style={{ textDecoration: "none", flex: "none" }}>
                {({ isActive }) => (
                  <div
                    style={{
                      padding: "8px 6px 12px",
                      font: "700 var(--text-body-size) var(--font-family-body)",
                      color: isActive ? "var(--color-bg-fill-primary-active)" : "var(--color-text-tertiary-default)",
                      borderBottom: isActive ? "2px solid var(--color-bg-fill-primary-default)" : "2px solid transparent",
                    }}
                  >
                    {n.label}
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, padding: "18px 16px calc(28px + var(--safe-bottom))", maxWidth: 820, width: "100%", margin: "0 auto" }}>
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100svh", background: "var(--color-bg-canvas-default)" }}>
      <div
        style={{
          width: 250,
          flex: "none",
          background: "var(--color-bg-surface-primary-default)",
          borderRight: "1px solid var(--color-border-primary-default)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
          position: "sticky",
          top: 0,
          height: "100svh",
        }}
      >
        <img src="/wordmark.png" alt="Bizqwik" style={{ height: 24, width: "auto", alignSelf: "flex-start", margin: "0 8px 12px", display: "block" }} />
        <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", padding: "0 8px 20px" }}>OPS DASHBOARD</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--color-border-primary-default)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px" }}>
            <Avatar name={bizqwikTeam.name} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "600 var(--text-body-size) var(--font-family-body)", lineHeight: 1.1, color: "var(--color-text-primary-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bizqwikTeam.name}</div>
              <div style={{ font: "400 var(--text-caption-1-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>{BIZQWIK_ROLE_LABELS[bizqwikTeam.role]}</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: 6, padding: "10px 12px", border: 0, background: "none", color: "var(--color-text-secondary-default)", cursor: "pointer", font: "600 var(--text-body-size) var(--font-family-body)", borderRadius: "var(--radius-item)" }}
          >
            <Icon name="logout" size={18} /> Sign out
          </button>
        </div>
      </div>
      {/* Fill the space beside the sidebar, same as the org Shell — no
          centered/capped column, which on wide screens left the body frozen
          at 860px in a sea of empty gutters. */}
      <div style={{ flex: 1, minWidth: 0, padding: "34px 30px 60px" }}>
        <Outlet />
      </div>
    </div>
  );
}

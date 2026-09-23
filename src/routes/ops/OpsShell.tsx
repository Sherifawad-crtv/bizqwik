import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useIsMobile } from "../../lib/useIsMobile";
import { Icon, type IconName } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { BIZQWIK_ROLE_LABELS } from "../../lib/types";

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
          data-sq
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 12px",
            borderRadius: "var(--r-tile)",
            cursor: "pointer",
            background: isActive ? "var(--primary-tint)" : "transparent",
            color: isActive ? "var(--primary-pressed)" : "var(--ink-muted)",
            font: "600 16px var(--font-body)",
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
      <div style={{ minHeight: "100svh", background: "var(--paper)", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "var(--surface)",
            borderBottom: "1px solid var(--line)",
            padding: "calc(12px + var(--safe-top)) 16px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src="/wordmark.png" alt="Bizqwik" style={{ height: 22, width: "auto", display: "block" }} />
            <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>OPS</span>
            <button
              onClick={logout}
              aria-label="Sign out"
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, border: 0, background: "none", color: "var(--ink-faint)", cursor: "pointer", font: "700 13px var(--font-body)" }}
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
                      font: "700 15px var(--font-body)",
                      color: isActive ? "var(--primary-pressed)" : "var(--ink-faint)",
                      borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
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
    <div style={{ display: "flex", minHeight: "100svh", background: "var(--paper)" }}>
      <div
        style={{
          width: 250,
          flex: "none",
          background: "var(--surface)",
          borderRight: "1px solid var(--line)",
          display: "flex",
          flexDirection: "column",
          padding: "22px 16px",
          position: "sticky",
          top: 0,
          height: "100svh",
        }}
      >
        <img src="/wordmark.png" alt="Bizqwik" style={{ height: 24, width: "auto", alignSelf: "flex-start", margin: "0 8px 12px", display: "block" }} />
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", padding: "0 8px 20px" }}>OPS DASHBOARD</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </div>
        <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px" }}>
            <Avatar name={bizqwikTeam.name} size={34} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: "600 15px var(--font-body)", lineHeight: 1.1, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bizqwikTeam.name}</div>
              <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>{BIZQWIK_ROLE_LABELS[bizqwikTeam.role]}</div>
            </div>
          </div>
          <button
            onClick={logout}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", marginTop: 6, padding: "10px 12px", border: 0, background: "none", color: "var(--ink-muted)", cursor: "pointer", font: "600 15px var(--font-body)", borderRadius: "var(--r-tile)" }}
          >
            <Icon name="logout" size={18} /> Sign out
          </button>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 860, padding: "34px 32px 60px" }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

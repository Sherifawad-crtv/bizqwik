import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../shared/auth";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { Icon, type IconName } from "../../design-system/components/Icon";
import { Avatar } from "../../design-system/components/Avatar";
import { BIZQWIK_ROLE_LABELS } from "../../shared/types";
import "./OpsShell.css";

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/bizqwik", label: "Overview", icon: "insights", end: true },
  { to: "/bizqwik/team", label: "Team", icon: "coaches" },
  { to: "/bizqwik/plans", label: "Plans", icon: "tag" },
];

function NavItem({ to, label, icon, end, onNavigate }: { to: string; label: string; icon: IconName; end?: boolean; onNavigate?: () => void }) {
  return (
    <NavLink className="bq-ops-shell-nav-item-part" to={to} end={end} onClick={onNavigate}>
      {({ isActive }) => (
        <div className="bq-ops-shell-nav-item-text"
          style={{ background: isActive ? "var(--color-bg-fill-accent-default)" : "transparent", color: isActive ? "var(--color-bg-fill-primary-active)" : "var(--color-text-secondary-default)" }}
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
      <div className="bq-ops-shell-stack">
        <div className="bq-ops-shell-box"
        >
          <div className="bq-flex bq-items-center bq-gap-10px">
            <img className="bq-ops-shell-img" src="/wordmark.png" alt="Bizqwik" />
            <span className="bq-label">OPS</span>
            <button className="bq-ops-shell-btn"
              onClick={logout}
              aria-label="Sign out"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
          <div className="bq-ops-shell-row">
            {NAV.map((n) => (
              <NavLink className="bq-ops-shell-part" key={n.to} to={n.to} end={n.end}>
                {({ isActive }) => (
                  <div className="bq-ops-shell-title"
                    style={{ color: isActive ? "var(--color-bg-fill-primary-active)" : "var(--color-text-tertiary-default)", borderBottom: isActive ? "2px solid var(--color-bg-fill-primary-default)" : "2px solid transparent" }}
                  >
                    {n.label}
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
        <div className="bq-ops-shell-size">
          <Outlet />
        </div>
      </div>
    );
  }

  return (
    <div className="bq-ops-shell-row-2">
      <div className="bq-ops-shell-stack-2"
      >
        <img className="bq-ops-shell-img-2" src="/wordmark.png" alt="Bizqwik" />
        <div className="bq-ops-shell-label">OPS DASHBOARD</div>
        <div className="bq-flex bq-col bq-gap-1">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </div>
        <div className="bq-ops-shell-part-2">
          <div className="bq-ops-shell-row-3">
            <Avatar name={bizqwikTeam.name} size={34} />
            <div className="bq-min-w-0">
              <div className="bq-ops-shell-text">{bizqwikTeam.name}</div>
              <div className="bq-ops-shell-meta">{BIZQWIK_ROLE_LABELS[bizqwikTeam.role]}</div>
            </div>
          </div>
          <button className="bq-ops-shell-btn-2"
            onClick={logout}
          >
            <Icon name="logout" size={18} /> Sign out
          </button>
        </div>
      </div>
      {/* Fill the space beside the sidebar, same as the org Shell — no
          centered/capped column, which on wide screens left the body frozen
          at 860px in a sea of empty gutters. */}
      <div className="bq-ops-shell-part-3">
        <Outlet />
      </div>
    </div>
  );
}

import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./auth";
import type { Role } from "./types";

export function RequireAuth() {
  const { profile, bizqwikTeam, ready } = useAuth();

  if (!ready) return null;
  if (profile) return <Outlet />;
  // A Bizqwik-team member has no org profile — send them to the ops dashboard
  // rather than bouncing them to /login as if they weren't signed in.
  if (bizqwikTeam) return <Navigate to="/bizqwik" replace />;
  return <Navigate to="/login" replace />;
}

// Gates the /bizqwik ops dashboard to Bizqwik-team members. An org user (no
// team membership) is sent back to their own app root.
export function RequireBizqwikTeam() {
  const { bizqwikTeam, ready } = useAuth();
  if (!ready) return null;
  if (!bizqwikTeam) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Front-desk screens: the front desk, or the owner of a solo business who does
// that work herself.
export function RequireDesk() {
  const { profile, orgMode } = useAuth();
  if (!profile) return null;
  if (profile.role === "front_desk" || (profile.role === "dept_head" && orgMode === "solo")) return <Outlet />;
  return <Navigate to="/" replace />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

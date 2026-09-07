import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth";
import type { Role } from "./types";

export function RequireAuth() {
  const { profile, ready } = useAuth();
  const location = useLocation();

  if (!ready) return null;
  if (!profile) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RequireRole({ roles }: { roles: Role[] }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

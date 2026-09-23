import { lazy, Suspense } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { CoachWallet } from "./CoachWallet";
import { Spinner } from "../components/Spinner";

const FrontDeskHome = lazy(() => import("./frontdesk/FrontDeskHome").then((m) => ({ default: m.FrontDeskHome })));

export function Home() {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role === "accountant") return <Navigate to="/pay" replace />;
  if (profile.role === "dept_head") return <Navigate to="/oversight" replace />;
  if (profile.role === "front_desk") {
    return (
      <Suspense fallback={<Spinner />}>
        <FrontDeskHome />
      </Suspense>
    );
  }
  return <CoachWallet />;
}

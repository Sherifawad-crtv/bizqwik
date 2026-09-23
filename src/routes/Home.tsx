import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { CoachWallet } from "./CoachWallet";
import { FrontDeskHome } from "./frontdesk/FrontDeskHome";

export function Home() {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role === "accountant") return <Navigate to="/pay" replace />;
  if (profile.role === "dept_head") return <Navigate to="/oversight" replace />;
  if (profile.role === "front_desk") return <FrontDeskHome />;
  return <CoachWallet />;
}

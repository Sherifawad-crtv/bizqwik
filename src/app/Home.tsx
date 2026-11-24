import { Navigate } from "react-router-dom";
import { useAuth } from "../shared/session/auth";
import { CoachWallet } from "../features/coaches";
import { FrontDeskHome, SoloHome } from "../features/frontdesk";

export function Home() {
  const { profile, orgMode } = useAuth();
  if (!profile) return null;
  if (profile.role === "accountant") return <Navigate to="/pay" replace />;
  if (profile.role === "dept_head") return orgMode === "solo" ? <SoloHome /> : <Navigate to="/oversight" replace />;
  if (profile.role === "front_desk") return <FrontDeskHome />;
  return <CoachWallet />;
}

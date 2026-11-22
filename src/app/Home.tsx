import { Navigate } from "react-router-dom";
import { useAuth } from "../shared/auth";
import { CoachWallet } from "../features/coaches";
import { FrontDeskHome } from "../features/frontdesk/FrontDeskHome";
import { SoloHome } from "../features/frontdesk/SoloHome";

export function Home() {
  const { profile, orgMode } = useAuth();
  if (!profile) return null;
  if (profile.role === "accountant") return <Navigate to="/pay" replace />;
  if (profile.role === "dept_head") return orgMode === "solo" ? <SoloHome /> : <Navigate to="/oversight" replace />;
  if (profile.role === "front_desk") return <FrontDeskHome />;
  return <CoachWallet />;
}

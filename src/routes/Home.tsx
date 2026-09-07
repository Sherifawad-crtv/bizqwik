import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { CoachWallet } from "./CoachWallet";

export function Home() {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role === "accountant") return <Navigate to="/pay" replace />;
  return <CoachWallet />;
}

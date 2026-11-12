import { useAuth } from "../lib/auth";
import { isSoloOwner } from "../lib/nav";
import { FabButton } from "./fab/FabButton";
import { CreateFab } from "./fab/CreateFab";
import { ScanFlow } from "./fab/ScanFlow";
import { SoloFab } from "./fab/SoloFab";

export function Fab({ size = 64 }: { size?: number }) {
  const { profile, orgMode } = useAuth();
  if (!profile) return null;
  if (isSoloOwner(profile.role, orgMode)) return <SoloFab size={size} />;
  if (profile.role === "dept_head") return <CreateFab size={size} />;
  return <ScanFlow trigger={(open, busy) => <FabButton size={size} label="Scan" onClick={open} opacity={busy ? 0.55 : 1} />} />;
}

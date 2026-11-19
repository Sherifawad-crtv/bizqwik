import { useAuth } from "../shared/auth";
import { isSoloOwner } from "../shared/screen/nav";
import { FabButton } from "./fab/FabButton";
import { CreateFab } from "./fab/CreateFab";
import { ScanFlow } from "../shared/components/ScanFlow";
import { SoloFab } from "./fab/SoloFab";

export function Fab({ size = 64 }: { size?: number }) {
  const { profile, orgMode } = useAuth();
  if (!profile) return null;
  if (isSoloOwner(profile.role, orgMode)) return <SoloFab size={size} />;
  if (profile.role === "dept_head") return <CreateFab size={size} />;
  return <ScanFlow trigger={(open, busy) => <FabButton size={size} label="Scan" onClick={open} opacity={busy ? 0.55 : 1} />} />;
}

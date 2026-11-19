import type { OrgStatus } from "../../shared/types";
import { ORG_STATUS_LABELS } from "../../shared/types";
import { StatusBadge, type Tone } from "../../design-system/components/Tag";




const STATUS_TONE: Record<OrgStatus, Tone> = { trial: "logging", active: "paid", paused: "danger" };

export function StatusPill({ status }: { status: OrgStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{ORG_STATUS_LABELS[status].toUpperCase()}</StatusBadge>;
}

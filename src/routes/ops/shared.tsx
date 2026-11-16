import type { OrgStatus } from "../../lib/types";
import { ORG_STATUS_LABELS } from "../../lib/types";
import { StatusBadge, type Tone } from "../../components/Tag";



export function ErrorBanner({ text }: { text: string }) {
  return (
    <div  className="bq-error bq-error--spaced">
      {text}
    </div>
  );
}

const STATUS_TONE: Record<OrgStatus, Tone> = { trial: "logging", active: "paid", paused: "danger" };

export function StatusPill({ status }: { status: OrgStatus }) {
  return <StatusBadge tone={STATUS_TONE[status]}>{ORG_STATUS_LABELS[status].toUpperCase()}</StatusBadge>;
}

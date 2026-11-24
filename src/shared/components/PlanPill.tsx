import type { ClientWithPackage } from "../types";
import { deskStatus } from "../domain/deskStatus";
import { StatusBadge, type Tone } from "../../design-system/components/Tag";

export type StatusTone = "good" | "warn" | "frozen" | "pt" | "bad" | "none";

const TONE: Record<StatusTone, Tone> = { good: "paid", warn: "logging", frozen: "frozen", pt: "settled", bad: "danger", none: "neutral" };

export function PlanPill({ client }: { client: ClientWithPackage }) {
  const s = deskStatus(client);
  return (
    <StatusBadge tone={TONE[s.tone]} data-testid="status-pill" data-tone={s.tone}>
      {s.label}
    </StatusBadge>
  );
}

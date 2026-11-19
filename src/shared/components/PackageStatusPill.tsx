import { PACKAGE_STATUS_LABELS } from "../types";
import type { PackageStatus } from "../types";
import { StatusBadge, type Tone } from "../../design-system/components/Tag";

const TONE: Record<PackageStatus, Tone> = { active: "paid", exhausted: "neutral", expired: "danger" };

/** A PT package's state (ACTIVE / USED UP / EXPIRED). */
export function PackageStatusPill({ status }: { status: PackageStatus }) {
  return <StatusBadge tone={TONE[status]}>{PACKAGE_STATUS_LABELS[status].toUpperCase()}</StatusBadge>;
}

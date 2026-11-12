import { dateLabel } from "../../lib/format";
import type { ClientWithPackage, GroupPlan } from "../../lib/types";
import { GROUP_PLAN_KIND_LABELS } from "../../lib/types";

export interface CoachOption {
  id: string;
  name: string;
}

export function daysLeft(expiryDate: string): number {
  return Math.max(0, Math.ceil((Date.parse(expiryDate) - Date.now()) / 86400000));
}

export function countdownText(client: ClientWithPackage): string | null {
  const pkg = client.currentPackage;
  if (!pkg || pkg.status !== "active") return null;
  return `${pkg.sessionsRemaining} of ${pkg.sessionsIncluded} left · ${daysLeft(pkg.expiryDate)} days left`;
}

/** Own-package meta line: distinguishes "never bought a package" from
 * "had one, but it's exhausted/expired" — the status pill next to this text
 * already names which, so this fills in what the pill can't: how long is
 * left (active) or when it ended. */
export function packageMetaText(client: ClientWithPackage): string {
  const pkg = client.currentPackage;
  if (!pkg) return "No package yet";
  if (pkg.status === "active") return countdownText(client)!;
  return `Sold ${dateLabel(pkg.purchaseDate)}`;
}

export const EXPIRING_SOON_DAYS = 7;

export function groupPlanLine(p: GroupPlan): string {
  const until = `until ${dateLabel(p.expiresAt.slice(0, 10))}`;
  if (p.kind === "bundle") return `${p.creditsRemaining} of ${p.creditsTotal} classes left · ${until}`;
  return `${GROUP_PLAN_KIND_LABELS[p.kind]} · ${until}`;
}

export function plusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function rosterGrid(canManage: boolean): string {
  return `2fr 1.3fr 1fr 1.1fr ${canManage ? "84px" : "20px"}`;
}

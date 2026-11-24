import type { Role } from "./org";

// Coach pay: tiers, logged sessions, QR scans and each coach's monthly rollup.

export type State = "logging" | "settled" | "paid";

export interface Tier {
  id: string;
  name: string;
  rate: number;
  privateCutPct: number;
}

export interface Session {
  id: string;
  coachId: string;
  month: string;
  date: string;
  createdBy: string;
  /** "qr" = the coach scanned the coaches' QR; "manual" = a head logged it. */
  source?: "qr" | "manual";
  /** When the session was recorded (the scan time for a QR session). */
  createdAt?: string | null;
}

export interface PtScanPreview {
  id: string;
  clientName: string;
  bundleName: string;
  sessionsRemaining: number;
  sessionsIncluded: number;
  expiryDate: string;
}

export type ScanResult =
  | { kind: "attendance"; date: string; month: string }
  | { kind: "pt"; package: PtScanPreview };

export interface Rollup {
  coachId: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  tierId: string | null;
  tierName: string | null;
  rate: number;
  count: number;
  groupTotal: number;
  privateTotal: number;
  packageCount: number;
  total: number;
  state: State;
  settledAt: string | null;
  paidAt: string | null;
  /** Paid out of a settled month so far (all of it once paid), and what's left to pay. */
  paidAmount: number;
  remaining: number;
}

export const STATE_LABELS: Record<State, string> = {
  logging: "Logging",
  settled: "Settled",
  paid: "Paid",
};

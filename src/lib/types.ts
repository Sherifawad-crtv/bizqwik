export type Role = "dept_head" | "head_coach" | "coach" | "accountant";
export type State = "logging" | "settled" | "paid";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  tierId: string | null;
}

export interface Tier {
  id: string;
  name: string;
  rate: number;
}

export interface Session {
  id: string;
  coachId: string;
  month: string;
  date: string;
  createdBy: string;
}

export interface Invite {
  email: string;
  role: Role;
  tierId: string | null;
  invitedBy: string;
}

export interface Rollup {
  coachId: string;
  name: string;
  email: string;
  role: Role;
  tierId: string | null;
  tierName: string | null;
  rate: number;
  count: number;
  total: number;
  state: State;
  settledAt: string | null;
  paidAt: string | null;
}

export const isHead = (r?: Role) => r === "dept_head" || r === "head_coach";
export const canLog = (r?: Role) => !!r && r !== "accountant";

export const ROLE_LABELS: Record<Role, string> = {
  dept_head: "Department Head",
  head_coach: "Head Coach",
  coach: "Coach",
  accountant: "Head Accountant",
};

export const STATE_LABELS: Record<State, string> = {
  logging: "Logging",
  settled: "Settled",
  paid: "Paid",
};

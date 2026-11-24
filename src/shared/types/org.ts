// The business itself: staff roles and profiles, its locations, and the
// Bizqwik team that runs the platform.

export type Role = "dept_head" | "head_coach" | "coach" | "accountant" | "front_desk";

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  tierId: string | null;
  avatarUrl: string | null;
}

// A place the business runs sessions. Plans, PT bundles and sessions can be
// tied to one; a member has a home location.
export interface Location {
  id: string;
  name: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  dept_head: "Department Head",
  head_coach: "Head Coach",
  coach: "Coach",
  accountant: "Head Accountant",
  front_desk: "Front Desk",
};

// ===== Bizqwik ops (internal, bizqwik_team only) =====
// A Bizqwik-team member runs the platform itself, across every org. They have
// no org profile — these types describe the ops dashboard, not any single gym.
export type BizqwikRole = "founder" | "ops_manager" | "teammate";

export interface BizqwikTeam {
  id: string;
  name: string;
  email: string;
  role: BizqwikRole;
}

export const BIZQWIK_ROLE_LABELS: Record<BizqwikRole, string> = {
  founder: "Founder",
  ops_manager: "Ops Manager",
  teammate: "Teammate",
};

import type { Role } from "../types/org";

// Who counts as what, by role.
export const isHead = (r?: Role) => r === "dept_head" || r === "head_coach";
// Who counts as a "coach" — shows up in coach rosters/rollups, gets picked as
// a private-training coach, etc. dept_head is management-only for now (no
// personal group sessions, no My Month, not a private-training coach) —
// revisit if v2 brings that back.
export const canLog = (r?: Role) => r === "coach" || r === "head_coach";
// Roles paid per session, so a pay tier means something for them.
export const hasTier = (r?: Role) => r === "coach" || r === "head_coach" || r === "dept_head";

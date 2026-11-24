// Manage's data types: the shapes its server calls return and its
// screens show. Types several features use stay in shared/types.ts.
import type { Role } from "../../../shared/types";

export interface Invite {
  email: string;
  role: Role;
  tierId: string | null;
  invitedBy: string;
}

import type { ClientWithPackage, Role } from "../../../shared/types";
import { planFacts } from "./clientFilters";
import { EXPIRING_SOON_DAYS } from "./clientText";

// Who sees which clients, coach names, roster counts and permissions.
// Pure functions: no React, no server calls.

export interface CoachOption {
  id: string;
  name: string;
}

/** dept_head sees the full roster, read-only apart from edits, deletes and
 * goodwill credit: registering clients and selling plans/packages is the
 * front desk's job. Head coach's private-training role is the same as a
 * plain coach's: view their own assigned clients and log deliveries. */
export function isRosterManager(role: Role | undefined): boolean {
  return role === "dept_head";
}

export function visibleClients(all: ClientWithPackage[], role: Role, myId: string): ClientWithPackage[] {
  return isRosterManager(role) ? all : all.filter((c) => c.assignedCoachId === myId);
}

/** Looks up a coach's name; "—" for an unknown coach, null when unassigned. */
export function coachNameLookup(coaches: CoachOption[]): (id: string | null) => string | null {
  return (id) => (id ? (coaches.find((c) => c.id === id)?.name ?? "—") : null);
}

/** The coaches who actually have clients in this roster, by name. */
export function coachChoices(clients: ClientWithPackage[], coachName: (id: string | null) => string | null): CoachOption[] {
  return [...new Set(clients.map((c) => c.assignedCoachId).filter((id): id is string => !!id))]
    .map((id) => ({ id, name: coachName(id) ?? "—" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface RosterCounts {
  total: number;
  onGroupPlan: number;
  active: number;
  needsRenewal: number;
  expiringSoon: number;
}

export function rosterCounts(clients: ClientWithPackage[], nowMs: number): RosterCounts {
  const facts = clients.map((c) => planFacts(c, nowMs));
  return {
    total: clients.length,
    onGroupPlan: clients.filter((c) => c.groupPlan).length,
    active: facts.filter((f) => f.state === "active").length,
    needsRenewal: facts.filter((f) => f.state === "ended").length,
    expiringSoon: facts.filter((f) => f.state === "active" && f.daysLeft !== null && f.daysLeft <= EXPIRING_SOON_DAYS).length,
  };
}

/** A coach logs a PT session by scanning the member's code — only for their own client with an active package. */
export function canLogSession(client: ClientWithPackage, role: Role, myId: string): boolean {
  const pkg = client.currentPackage;
  return role !== "accountant" && client.assignedCoachId === myId && !!pkg && pkg.status === "active";
}

type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** Goodwill wallet credit: a positive amount, optional note. */
export function checkCompensation(amountText: string, noteText: string): Checked<{ amount: number; note: string | undefined }> {
  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter an amount." };
  return { ok: true, value: { amount, note: noteText.trim() || undefined } };
}

/** Client edit form: a name is required; age and conditions are optional. */
export function checkClientEdit(name: string, ageText: string, conditions: string): Checked<{ name: string; age: number | null; conditions: string | null }> {
  if (!name.trim()) return { ok: false, error: "Enter a name." };
  return { ok: true, value: { name: name.trim(), age: ageText.trim() ? Number(ageText) : null, conditions: conditions.trim() || null } };
}

import type { BizqwikRole, BizqwikTeam, BizqwikTeamInvite, OpsSummary, OrgBrandingConfig, OrgConfig, OrgPointsSettings, OrgDetail, OrgStatus, OrgSummary, PlanType } from "../types";
import { callFn } from "./core";

export const opsApi = {
  // ===== Bizqwik ops dashboard (bizqwik_team only) =====
  ops: {
    summary: () => callFn<OpsSummary>("ops/summary"),
    orgs: () => callFn<{ orgs: OrgSummary[] }>("ops/orgs"),
    createOrg: (name: string, slug: string, deptHeadName: string, deptHeadEmail: string, planId: string | null) =>
      callFn<{ org: OrgSummary; deptHeadEmail: string; domain?: { name: string; connected: boolean; reason: string | null } }>("ops/orgs", {
        method: "POST",
        body: { name, slug, deptHeadName, deptHeadEmail, planId },
      }),
    org: (id: string) => callFn<OrgDetail>(`ops/orgs/${id}`),
    setOrgStatus: (id: string, status: OrgStatus) =>
      callFn<{ ok: true; status: OrgStatus }>(`ops/orgs/${id}/status`, { method: "POST", body: { status } }),
    setOrgMode: (id: string, mode: "solo" | "team") =>
      callFn<{ ok: true; mode: "solo" | "team" }>(`ops/orgs/${id}/mode`, { method: "POST", body: { mode } }),
    setOrgPlan: (id: string, planId: string | null) =>
      callFn<{ ok: true; planId: string | null }>(`ops/orgs/${id}/plan`, { method: "POST", body: { planId } }),
    // Permanent: removes the org and everything under it. `confirmSlug` must match.
    deleteOrg: (id: string, confirmSlug: string) =>
      callFn<{ ok: true; name: string; loginsRemoved: number }>(`ops/orgs/${id}/delete`, { method: "POST", body: { confirmSlug } }),
    orgConfig: (id: string) => callFn<OrgConfig>(`ops/orgs/${id}/config`),
    setOrgBranding: (id: string, b: OrgBrandingConfig) =>
      callFn<{ ok: true }>(`ops/orgs/${id}/branding`, { method: "POST", body: { ...b } }),
    setOrgSettings: (id: string, settings: OrgPointsSettings) =>
      callFn<{ ok: true }>(`ops/orgs/${id}/settings`, { method: "POST", body: { ...settings } }),

    team: () => callFn<{ members: BizqwikTeam[]; invites: BizqwikTeamInvite[] }>("ops/team"),
    inviteTeam: (name: string, email: string, role: BizqwikRole) =>
      callFn<{ ok: true }>("ops/team/invite", { method: "POST", body: { name, email, role } }),
    cancelTeamInvite: (email: string) => callFn<{ ok: true }>("ops/team/cancel-invite", { method: "POST", body: { email } }),

    plans: () => callFn<{ plans: PlanType[] }>("ops/plans"),
    createPlan: (name: string, price: number, teamSizeLimit: number | null, clientSizeLimit: number | null) =>
      callFn<{ plan: PlanType }>("ops/plans", { method: "POST", body: { name, price, teamSizeLimit, clientSizeLimit } }),
    updatePlan: (id: string, name: string, price: number, teamSizeLimit: number | null, clientSizeLimit: number | null) =>
      callFn<{ plan: PlanType }>("ops/plans/update", { method: "POST", body: { id, name, price, teamSizeLimit, clientSizeLimit } }),
    deletePlan: (id: string) => callFn<{ ok: true }>("ops/plans/delete", { method: "POST", body: { id } }),
  },
};

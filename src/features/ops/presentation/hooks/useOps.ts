import { useState } from "react";
import { useAsync } from "../../../../shared/api/useAsync";
import { useSave } from "../../../../shared/api/useSave";
import type { BizqwikRole } from "../../../../shared/types";
import type { OrgDetail, OrgStatus, PlanType } from "../../domain/types";
import { opsRepository as repo } from "../../data/opsRepository";
import { checkAppConfig, checkNewOrg, checkSaasPlan, type AppConfigForm } from "../../domain/ops";

// ---- Reads -------------------------------------------------------------------

export const useOpsSummary = () => useAsync(() => repo.summary(), []);
export const useOrgs = () => useAsync(() => repo.orgs(), []);
export const useSaasPlans = () => useAsync(() => repo.plans(), []);
export const useOrg = (id: string) => useAsync(() => repo.org(id), [id]);
export const useOrgConfig = (id: string) => useAsync(() => repo.orgConfig(id), [id]);
export const useOpsTeam = () => useAsync(() => repo.team(), []);

// ---- One organization --------------------------------------------------------

/** Change an org's status, app type or SaaS plan. Each resolves to true when it saved. */
export function useOrgActions(id: string, org: OrgDetail["org"] | null) {
  const { busy, error, setError, run } = useSave();
  return {
    busy,
    error,
    setStatus: async (status: OrgStatus) => (status === org?.status ? false : run(() => repo.setOrgStatus(id, status), { fallback: "Couldn't update status." })),
    setMode: async (mode: "solo" | "team") => (mode === (org?.mode ?? "team") ? false : run(() => repo.setOrgMode(id, mode), { fallback: "Couldn't update the app type." })),
    setPlan: (planId: string) => run(() => repo.setOrgPlan(id, planId || null), { fallback: "Couldn't update plan." }),
    setError,
  };
}

/** Create an org. Resolves to what the success step shows, or null if it failed. */
export function useCreateOrg() {
  const { busy, error, setError, run } = useSave();
  const create = async (name: string, slug: string, headName: string, headEmail: string, planId: string) => {
    setError(null);
    const checked = checkNewOrg(name, slug, headEmail);
    if (!checked.ok) {
      setError(checked.error);
      return null;
    }
    let res: Awaited<ReturnType<typeof repo.createOrg>> | null = null;
    await run(async () => {
      res = await repo.createOrg(name.trim(), slug, headName.trim(), headEmail.trim(), planId || null);
    });
    return res as Awaited<ReturnType<typeof repo.createOrg>> | null;
  };
  return { create, busy, error, setError };
}

/** Permanently delete an org. Stays busy after success: the screen navigates away. */
export function useDeleteOrg() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async (id: string, typedSlug: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await repo.deleteOrg(id, typedSlug.trim());
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this organization.");
      setBusy(false);
      return false;
    }
  };
  return { remove, busy, error, setError };
}

/** Save the member-app branding and points settings. */
export function useSaveAppConfig(id: string) {
  const { busy, error, setError, run } = useSave("Couldn't save member-app config.");
  const save = async (form: AppConfigForm): Promise<boolean> => {
    setError(null);
    const checked = checkAppConfig(form);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    return run(async () => {
      await repo.setOrgBranding(id, checked.value.branding);
      await repo.setOrgSettings(id, checked.value.settings);
    });
  };
  return { save, busy, error };
}

/** Upload a branding image; resolves to its URL, or null if it failed. */
export function useAssetUpload(orgId: string, assetKey: string) {
  const { busy, error, run } = useSave("Couldn't upload that image.");
  const upload = async (makeBlob: () => Promise<Blob>): Promise<string | null> => {
    let url: string | null = null;
    await run(async () => {
      url = await repo.uploadOrgAsset(orgId, assetKey, await makeBlob());
    });
    return url;
  };
  return { upload, busy, error };
}

// ---- SaaS plans and the ops team ---------------------------------------------

export function useSaasPlanActions() {
  const { busy, error, setError, run } = useSave();
  const save = async (plan: PlanType | null, name: string, price: string, team: string, client: string): Promise<boolean> => {
    setError(null);
    const checked = checkSaasPlan(name, price, team, client);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    const v = checked.value;
    return run(() => (plan ? repo.updatePlan(plan.id, v.name, v.price, v.teamLimit, v.clientLimit) : repo.createPlan(v.name, v.price, v.teamLimit, v.clientLimit)));
  };
  return { save, busy, error, setError, remove: (id: string) => repo.deletePlan(id) };
}

export function useTeamActions() {
  const { busy, error, setError, run } = useSave();
  const invite = async (name: string, email: string, role: BizqwikRole): Promise<boolean> => {
    setError(null);
    if (!email.trim()) {
      setError("A valid email is required.");
      return false;
    }
    return run(() => repo.inviteTeam(name.trim(), email.trim(), role));
  };
  return { invite, busy, error, setError };
}

/** Cancel a pending ops-team invite. Resolves to the error message, or null when it worked. */
export async function cancelTeamInvite(email: string): Promise<string | null> {
  try {
    await repo.cancelTeamInvite(email);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : "Couldn't cancel invite.";
  }
}

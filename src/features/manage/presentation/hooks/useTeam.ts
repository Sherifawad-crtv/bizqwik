import { useAsync } from "../../../../shared/api/useAsync";
import { useSave } from "../../../../shared/api/useSave";
import type { Tier } from "../../../../shared/types";
import { manageRepository as repo } from "../../data/manageRepository";
import { checkTier } from "../../domain/team";

export function useTiers() {
  const { data } = useAsync(() => repo.tiers(), []);
  return data?.tiers ?? null;
}

export function usePeople() {
  const { data } = useAsync(() => repo.profiles(), []);
  return data?.profiles ?? null;
}

export function useInvites() {
  const { data } = useAsync(() => repo.invites(), []);
  return data?.invites ?? null;
}

/** Create or edit a tier. `save` returns true when it succeeded. */
export function useTierActions() {
  const { busy, error, setError, run } = useSave();
  const save = async (tier: Tier | null, name: string, rate: string, cut: string): Promise<boolean> => {
    const checked = checkTier(name, rate, cut);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    const v = checked.value;
    return run(() => (tier ? repo.updateTier(tier.id, v.name, v.rate, v.privateCutPct) : repo.createTier(v.name, v.rate, v.privateCutPct)));
  };
  return { save, busy, error, setError, remove: (id: string) => repo.deleteTier(id) };
}

/** Change a person's tier, or remove them. */
export function usePersonActions() {
  const { busy, error, setError, run } = useSave();
  return {
    busy,
    error,
    setError,
    assignTier: (profileId: string, tierId: string | null) => run(() => repo.assignTier(profileId, tierId)),
    remove: (profileId: string) => repo.removeProfile(profileId),
  };
}

export const cancelInvite = (email: string) => repo.deleteInvite(email);

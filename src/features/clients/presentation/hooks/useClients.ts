import { useAsync } from "../../../../shared/api/useAsync";
import type { Profile } from "../../../../shared/types";
import { clientsRepository } from "../../data/clientsRepository";
import { coachNameLookup, isRosterManager, visibleClients, type CoachOption } from "../../domain/roster";

/** The Clients screen's data: the roster this person may see and coach names. */
export function useClients(profile: Profile | null) {
  const isManager = isRosterManager(profile?.role);
  const { data } = useAsync(() => clientsRepository.list(), []);
  // Only managers see the assigned coach, so only they need the coach names.
  const { data: monthData } = useAsync(() => (isManager ? clientsRepository.coachesThisMonth() : Promise.resolve(null)), [isManager]);

  const coaches: CoachOption[] = (monthData?.rows ?? []).map((r) => ({ id: r.coachId, name: r.name }));
  return {
    isManager,
    loading: !data,
    clients: data && profile ? visibleClients(data.clients, profile.role, profile.id) : [],
    coachName: coachNameLookup(coaches),
  };
}

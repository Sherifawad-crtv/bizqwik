import { api, MOCK } from "../../../shared/api/backend";

// Data layer: every server call the clients feature makes, in one place.
// Screens never call `api` directly; they go through the hooks in
// presentation/hooks, which use this.
export const clientsRepository = {
  list: () => api.clients(),
  /** This month's coach rollup — the clients feature only uses it for coach names. */
  coachesThisMonth: () => api.month(MOCK.CURRENT_MONTH),
  update: (id: string, name: string, age: number | null, conditions: string | null) => api.updateClient(id, name, age, conditions),
  remove: (id: string) => api.deleteClient(id),
  compensate: (id: string, amount: number, note?: string) => api.compensateClient(id, amount, note),
};

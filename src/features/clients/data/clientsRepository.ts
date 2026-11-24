import { api, MOCK } from "../../../shared/api/backend";
import { callFn } from "../../../shared/api/core";
import type { Client } from "../../../shared/types";

// Data layer: every server call the clients feature makes, in one place.
// Screens never call `api` directly; they go through the hooks in
// presentation/hooks, which use this.
export const clientsRepository = {
  list: () => api.clients(),
  /** This month's coach rollup — the clients feature only uses it for coach names. */
  coachesThisMonth: () => api.month(MOCK.CURRENT_MONTH),
  update: (id: string, name: string, age: number | null, conditions: string | null) =>
    callFn<{ client: Client }>("clients/update", { method: "POST", body: { id, name, age, conditions } }),
  remove: (id: string) => callFn<void>("clients/delete", { method: "POST", body: { id } }),
  compensate: (clientId: string, amount: number, note?: string) =>
    callFn<{ ok: true; walletBalance?: number }>("clients/compensate", { method: "POST", body: { clientId, amount, note: note ?? null } }),
};

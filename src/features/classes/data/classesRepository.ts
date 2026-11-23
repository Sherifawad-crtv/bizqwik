import { api } from "../../../shared/api/backend";

// Data layer: the server calls the Sessions screen makes. Both are shared with
// the front desk, so they're wrapped here.
export const classesRepository = {
  classes: () => api.classes(),
  cancelClass: (id: string) => api.cancelClass(id),
};

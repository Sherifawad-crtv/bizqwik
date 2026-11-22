import type { Location } from "../types";
import { callFn } from "./core";

export const locationsApi = {
  // ===== Locations =====
  locations: () => callFn<{ locations: Location[] }>("locations"),
  setClientLocation: (id: string, locationId: string | null) => callFn<{ ok: true }>("clients/location", { method: "POST", body: { id, locationId } }),
};

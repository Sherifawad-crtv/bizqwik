import type { Location } from "../types";
import { callFn } from "./core";

export const locationsApi = {
  // ===== Locations =====
  locations: () => callFn<{ locations: Location[] }>("locations"),
  createLocation: (name: string) => callFn<{ location: Location }>("locations", { method: "POST", body: { name } }),
  renameLocation: (id: string, name: string) => callFn<{ location: Location }>("locations/update", { method: "POST", body: { id, name } }),
  setClientLocation: (id: string, locationId: string | null) => callFn<{ ok: true }>("clients/location", { method: "POST", body: { id, locationId } }),
  deleteBundleType: (id: string) => callFn<void>("bundle-types/delete", { method: "POST", body: { id } }),
};

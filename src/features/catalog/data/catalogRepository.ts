import { api } from "../../../shared/api/backend";
import { callFn, SOLO_DESK } from "../../../shared/api/core";
import type { DropInOption, PlanTypeInput } from "../../../shared/api/inputs";
import type { BundleType, GroupPlanType, Location } from "../../../shared/types";

// Data layer: every server call the catalog feature makes. The lists (plans,
// bundles, classes, locations, org settings) are shared with the front desk,
// so they're wrapped; creating, editing and deleting are catalog-only and live here.
export const catalogRepository = {
  // Group plans (memberships and class bundles)
  planTypes: () => api.planTypes(),
  createPlanType: (p: PlanTypeInput) => callFn<{ planType: GroupPlanType }>("plan-types", { method: "POST", body: { ...p } }),
  updatePlanType: (id: string, p: PlanTypeInput & { active?: boolean }) =>
    callFn<{ planType: GroupPlanType }>("plan-types/update", { method: "POST", body: { id, ...p } }),
  deletePlanType: (id: string) => callFn<{ ok: true }>("plan-types/delete", { method: "POST", body: { id } }),

  // Private-training bundles
  bundleTypes: () => api.bundleTypes(),
  createBundleType: (name: string, price: number, sessionsIncluded: number, expiryDays: number, locationId?: string | null) =>
    callFn<{ bundleType: BundleType }>("bundle-types", { method: "POST", body: { name, price, sessionsIncluded, expiryDays, locationId } }),
  updateBundleType: (id: string, name: string, price: number, sessionsIncluded: number, expiryDays: number, locationId?: string | null, active?: boolean) =>
    callFn<void>("bundle-types/update", { method: "POST", body: { id, name, price, sessionsIncluded, expiryDays, locationId, active } }),
  deleteBundleType: (id: string) => callFn<void>("bundle-types/delete", { method: "POST", body: { id } }),

  // Recurring classes (created and edited through the shared SeriesSheet)
  classSeries: () => api.classSeries(),

  // Locations
  locations: () => api.locations(),
  createLocation: (name: string) => callFn<{ location: Location }>("locations", { method: "POST", body: { name } }),
  renameLocation: (id: string, name: string) => callFn<{ location: Location }>("locations/update", { method: "POST", body: { id, name } }),

  // Solo owner's drop-in prices and InstaPay details
  orgSettings: () => api.orgSettings(),
  saveOrgSettings: (patch: { dropInPrice?: number | null; instapayQr?: string | null; instapayAddress?: string | null; locationId?: string; dropInOptions?: DropInOption[] }) =>
    callFn<{ ok: true }>("org-settings", { method: "POST", body: patch }, SOLO_DESK),
};

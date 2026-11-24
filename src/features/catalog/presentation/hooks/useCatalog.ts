import { useAsync } from "../../../../shared/api/useAsync";
import { useSave } from "../../../../shared/api/useSave";
import { useCurrentLocation } from "../../../../shared/session/locations";
import type { BundleType, GroupPlanType } from "../../../../shared/types";
import { catalogRepository as repo } from "../../data/catalogRepository";
import { catalogLocation, checkBundle, checkDropInPrice, checkDropIns, checkLocationName, checkPlan, type DropInRow, type PlanForm } from "../../domain/catalog";

/** With 2+ locations, the location the catalog is showing; else null (all). */
export function useCatalogHere(): string | null {
  const { locations, current } = useCurrentLocation();
  return catalogLocation(locations, current);
}

export const usePlanTypes = () => useAsync(() => repo.planTypes(), []).data?.planTypes ?? null;
export const useBundleTypes = () => useAsync(() => repo.bundleTypes(), []).data?.bundleTypes ?? null;
export const useClassSeries = () => useAsync(() => repo.classSeries(), []).data?.series ?? null;
export const useLocationList = () => {
  const { data } = useAsync(() => repo.locations(), []);
  return data ? (data.locations ?? []) : null;
};
export const useOrgSettings = () => useAsync(() => repo.orgSettings(), []);

/** Create or edit a group plan. `save` returns true when it succeeded. */
export function usePlanActions() {
  const { busy, error, setError, run } = useSave();
  const save = async (planType: GroupPlanType | null, form: PlanForm, hasLocations: boolean, onSale: boolean): Promise<boolean> => {
    const checked = checkPlan(form, hasLocations);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    const input = checked.value;
    return run(() => (planType ? repo.updatePlanType(planType.id, { ...input, active: onSale }) : repo.createPlanType(input)));
  };
  return { save, busy, error, setError, remove: (id: string) => repo.deletePlanType(id) };
}

/** Create or edit a PT bundle. `save` returns true when it succeeded. */
export function useBundleActions() {
  const { busy, error, setError, run } = useSave();
  const save = async (
    bundleType: BundleType | null,
    f: { name: string; price: string; sessions: string; expiryDays: string; locationId: string | null; onSale: boolean },
    opts: { solo: boolean; hasLocations: boolean },
  ): Promise<boolean> => {
    const checked = checkBundle(f.name, f.price, f.sessions, f.expiryDays, opts.solo, opts.hasLocations, f.locationId);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    const v = checked.value;
    return run(() =>
      bundleType
        ? repo.updateBundleType(bundleType.id, v.name, v.price, v.sessions, v.expiryDays, v.locationId, f.onSale)
        : repo.createBundleType(v.name, v.price, v.sessions, v.expiryDays, v.locationId),
    );
  };
  return { save, busy, error, setError, remove: (id: string) => repo.deleteBundleType(id) };
}

/** The solo owner's drop-in prices and InstaPay details. Each save returns true when it succeeded. */
export function useSoloSettingsActions(here: string | null) {
  const { busy, error, setError, run } = useSave("Couldn't save.");
  const failWith = (msg: string) => {
    setError(msg);
    return false;
  };
  return {
    busy,
    error,
    setError,
    saveAddress: (address: string) => run(() => repo.saveOrgSettings({ instapayAddress: address.trim() || null })),
    saveDropIns: async (rows: DropInRow[]) => {
      const checked = checkDropIns(rows);
      return checked.ok ? run(() => repo.saveOrgSettings({ locationId: here!, dropInOptions: checked.value })) : failWith(checked.error);
    },
    saveDropInPrice: async (price: string) => {
      const checked = checkDropInPrice(price);
      return checked.ok ? run(() => repo.saveOrgSettings(here ? { dropInPrice: checked.value, locationId: here } : { dropInPrice: checked.value })) : failWith(checked.error);
    },
    /** Saves the QR without the busy state; failures show "Couldn't save the QR." */
    saveQr: async (dataUrl: () => Promise<string>) => {
      setError(null);
      try {
        await repo.saveOrgSettings({ instapayQr: await dataUrl() });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save the QR.");
      }
    },
  };
}

/** Add or rename a location. `save` returns true when it succeeded. */
export function useLocationActions() {
  const { busy, error, setError, run } = useSave("Couldn't save.");
  const save = async (id: string | null, name: string): Promise<boolean> => {
    const checked = checkLocationName(name);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    return run(() => (id ? repo.renameLocation(id, checked.value) : repo.createLocation(checked.value)));
  };
  return { save, busy, error, setError };
}

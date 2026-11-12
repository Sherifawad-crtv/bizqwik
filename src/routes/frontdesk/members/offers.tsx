import { useAsync } from "../../../lib/useAsync";
import { api } from "../../../lib/backend";
import { fmt } from "../../../lib/format";
import type { BundleType, ClassSeries, CoachOption, GroupPlanType, Location } from "../../../lib/types";
import { atLocation, locationName } from "../../../lib/locations";
import { useAuth } from "../../../lib/auth";

export function useFrontDeskCatalog() {
  const { data: p } = useAsync(() => api.planTypes(), []);
  const { data: s } = useAsync(() => api.classSeries(), []);
  const { data: b } = useAsync(() => api.bundleTypes(), []);
  return {
    planTypes: p?.planTypes ?? [],
    series: (s?.series ?? []).filter((x) => x.status === "active"),
    bundleTypes: b?.bundleTypes ?? [],
  };
}

/** Everything the desk can sell as a group plan: catalog memberships and
 * bundles, plus each running class's monthly. Values are "pt:<id>" (plan
 * type) or "cs:<id>" (class series). */
export function groupOfferOptions(planTypes: GroupPlanType[], series: ClassSeries[], locations: Location[] = []) {
  const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;
  const at = (id: string | null | undefined) => (locationName(locations, id) ? ` · ${locationName(locations, id)}` : "");
  return [
    ...planTypes.map((t) => ({
      value: `pt:${t.id}`,
      label:
        t.kind === "bundle" && t.sharedSeats
          ? `${t.name} · ${fmt(t.price)} EGP · ${t.credits! / t.sharedSeats} classes each · ${months(t.durationMonths)}${at(t.locationId)}`
          : t.kind === "bundle"
          ? `${t.name} · ${fmt(t.price)} EGP · ${t.credits} classes · ${months(t.durationMonths)}${at(t.locationId)}`
          : `${t.name} · ${fmt(t.price)} EGP · all classes · ${months(t.durationMonths)}${at(t.locationId)}`,
    })),
    ...series.map((x) => ({ value: `cs:${x.id}`, label: `${x.title} monthly · ${fmt(x.monthlyPrice)} EGP · 1 month${at(x.locationId)}` })),
  ];
}

/** Who can be picked as the trainer on a PT sale. A solo owner trains her own
 * clients, so it's just her. */
export function useSellableCoaches(): CoachOption[] {
  const { profile, orgMode } = useAuth();
  const solo = profile?.role === "dept_head" && orgMode === "solo";
  const { data } = useAsync(() => (solo ? Promise.resolve({ coaches: [] as CoachOption[] }) : api.coaches()), [solo]);
  if (solo && profile) return [{ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl ?? null } as CoachOption];
  return data?.coaches ?? [];
}

export function offerOf(v: string): { planTypeId: string } | { seriesId: string } {
  return v.startsWith("cs:") ? { seriesId: v.slice(3) } : { planTypeId: v.slice(3) };
}

export type PlanKind = "plan" | "service";

// With 2+ locations, `here` keeps only that location's PT bundles.
export const bundleOptions = (types: BundleType[], locations: Location[] = [], here: string | null = null) =>
  types.filter((b) => b.active !== false && atLocation(b.locationId, locations.length > 1 ? here : null)).map((b) => ({ value: b.id, label: `${b.name} · ${fmt(b.price)} EGP · ${b.sessionsIncluded} sessions${locationName(locations, b.locationId) ? ` · ${locationName(locations, b.locationId)}` : ""}` }));

export const coachOptions = (coaches: CoachOption[]) => coaches.map((c) => ({ value: c.id, label: c.name }));

import { fmt } from "../../../../shared/format";
import type { BundleType, ClassSeries, GroupPlanType, Location } from "../../../../shared/types";
import type { CoachOption } from "../../domain/types";
import { atLocation, locationName } from "../../../../shared/locations";

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

// With 2+ locations, `here` keeps only that location's PT bundles.
export const bundleOptions = (types: BundleType[], locations: Location[] = [], here: string | null = null) =>
  types.filter((b) => b.active !== false && atLocation(b.locationId, locations.length > 1 ? here : null)).map((b) => ({ value: b.id, label: `${b.name} · ${fmt(b.price)} EGP · ${b.sessionsIncluded} sessions${locationName(locations, b.locationId) ? ` · ${locationName(locations, b.locationId)}` : ""}` }));

export const coachOptions = (coaches: CoachOption[]) => coaches.map((c) => ({ value: c.id, label: c.name }));

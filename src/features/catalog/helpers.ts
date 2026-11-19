import { useCurrentLocation } from "../../shared/locations";


/** With 2+ locations, the location the Plans tab is showing; else null (all). */
export function useCatalogHere(): string | null {
  const { locations, current } = useCurrentLocation();
  return locations.length > 1 ? (current?.id ?? null) : null;
}

import { useSyncExternalStore } from "react";
import { api } from "./backend";
import { useAsync } from "./useAsync";
import type { Location } from "./types";
import { SelectField } from "../components/FormField";

// Where the owner is working right now (this phone). Remembered per device, so
// switching location on Today applies to Schedule, check-in and new sessions.
const KEY = "bizqwik.location";
const listeners = new Set<() => void>();
function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export function setCurrentLocation(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    // private mode: it just won't be remembered
  }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The business's locations (empty when it has none — then nothing about
 * locations shows anywhere). */
export function useLocations(): Location[] {
  const { data } = useAsync(() => api.locations(), []);
  return data?.locations ?? [];
}

/** The location this phone is working at: the remembered one if it still
 * exists, else the first. Null when the business has no locations. */
export function useCurrentLocation(): { locations: Location[]; current: Location | null; setCurrent: (id: string) => void } {
  const locations = useLocations();
  const saved = useSyncExternalStore(subscribe, read, read);
  const current = locations.find((l) => l.id === saved) ?? locations[0] ?? null;
  return { locations, current, setCurrent: setCurrentLocation };
}

export const locationName = (locations: Location[], id: string | null | undefined) => (id ? (locations.find((l) => l.id === id)?.name ?? null) : null);

/** A small label naming a location; renders nothing for "everywhere". */
export function LocationPill({ locations, id }: { locations: Location[]; id: string | null | undefined }) {
  const name = locationName(locations, id);
  if (!name) return null;
  return (
    <span style={{ flex: "none", font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: "var(--primary-pressed)", background: "var(--primary-tint)", borderRadius: 8, padding: "3px 7px", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {name}
    </span>
  );
}

/** Pick a location in a form. Only shown when the business has locations. */
export function LocationField({ locations, value, onChange }: { locations: Location[]; value: string | null; onChange: (id: string) => void }) {
  if (locations.length === 0) return null;
  return <SelectField label="LOCATION" value={value ?? ""} options={locations.map((l) => ({ value: l.id, label: l.name }))} onChange={onChange} placeholder="Choose where" />;
}

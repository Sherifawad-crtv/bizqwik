import { todayIso } from "../../lib/format";
import type { GymClass } from "../../lib/types";
import { pad } from "../../lib/classTime";

export interface FormState {
  id: string | null; // null = creating
  title: string;
  description: string;
  date: string;
  time: string;
  price: string;
  // A one-off session carries its own photo; a series session shows its
  // series' photo (edited on the class, in Catalog).
  seriesId: string | null;
  imageUrl: string | null;
  // Where it happens (businesses with locations); null = no location.
  locationId: string | null;
  // Solo gyms: who said they're coming (read-only, shown when editing).
  coming?: string[];
}

export function emptyForm(): FormState {
  return { id: null, title: "", description: "", date: todayIso(), time: "18:00", price: "", seriesId: null, imageUrl: null, locationId: null };
}

export function formOf(c: GymClass): FormState {
  const d = new Date(c.startsAt);
  return {
    id: c.id,
    title: c.title,
    description: c.description ?? "",
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    price: String(c.price),
    seriesId: c.seriesId ?? null,
    imageUrl: c.seriesId ? null : (c.imageUrl ?? null),
    locationId: c.locationId ?? null,
    coming: c.coming,
  };
}

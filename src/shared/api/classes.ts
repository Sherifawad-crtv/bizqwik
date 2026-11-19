import type { GymClass } from "../types";
import { callFn } from "./core";

export const classesApi = {
  // ===== Classes (staff read; dept_head writes) =====
  classes: (since?: string) => callFn<{ classes: GymClass[] }>(since ? `classes?since=${encodeURIComponent(since)}` : "classes"),
  // `imageUrl` is the session's own photo; a series session sends null and
  // shows its series' photo.
  createClass: (title: string, description: string | null, startsAt: string, price: number, imageUrl: string | null = null, locationId?: string | null) =>
    callFn<{ class: GymClass }>("classes", { method: "POST", body: { title, description, startsAt, price, imageUrl, locationId } }),
  updateClass: (id: string, title: string, description: string | null, startsAt: string, price: number, imageUrl: string | null = null, locationId?: string | null) =>
    callFn<{ class: GymClass }>("classes/update", { method: "POST", body: { id, title, description, startsAt, price, imageUrl, locationId } }),
  cancelClass: (id: string) => callFn<{ ok: true }>("classes/cancel", { method: "POST", body: { id } }),
};

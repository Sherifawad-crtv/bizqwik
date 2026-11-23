import type { Location } from "../types";
import { callFn } from "./core";

export const locationsApi = {
  // ===== Locations =====
  locations: () => callFn<{ locations: Location[] }>("locations"),
};

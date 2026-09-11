import { MOCK } from "./backend";

/** "YYYY-01".."YYYY-12" for the current calendar year. */
export function currentYearMonths(): string[] {
  const year = MOCK.CURRENT_MONTH.slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

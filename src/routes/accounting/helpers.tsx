import { useState } from "react";
import { MOCK } from "../../lib/backend";

export const monthsBackList = (n: number): string[] => {
  const [y, m] = MOCK.CURRENT_MONTH.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
};

/** A small local "something changed, re-fetch" counter — the same idea as
 * the app's global `bump()`, but scoped to this screen so an expense edit
 * refreshes the P&L tab without re-fetching every open screen in the app. */
export function useAsyncBump() {
  const [key, setKey] = useState(0);
  return { key, bump: () => setKey((k) => k + 1) };
}

// ---- P&L ------------------------------------------------------------

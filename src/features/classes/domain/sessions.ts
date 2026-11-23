import type { GymClass } from "../../../shared/types";

// Session rules. Pure: no React, no server calls.

/** A session stays under "upcoming" until 3 hours after it starts. */
export const STILL_UPCOMING_MS = 3 * 60 * 60 * 1000;

/** Upcoming, past (newest first) and cancelled sessions. */
export function splitSessions(list: GymClass[], now: number) {
  const cutoff = now - STILL_UPCOMING_MS;
  return {
    scheduled: list.filter((c) => c.status === "active" && Date.parse(c.startsAt) >= cutoff),
    past: list.filter((c) => c.status === "active" && Date.parse(c.startsAt) < cutoff).reverse(),
    cancelled: list.filter((c) => c.status === "cancelled"),
  };
}

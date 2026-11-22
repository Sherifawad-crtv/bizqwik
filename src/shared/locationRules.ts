// Location rules with no React or server calls, so domain code can use them.

/** Does this item belong at `locationId`? Untied items (made before locations
 * existed) show everywhere so nothing goes missing. */
export const atLocation = (itemLocationId: string | null | undefined, locationId: string | null | undefined) =>
  !locationId || !itemLocationId || itemLocationId === locationId;

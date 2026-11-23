// Profile rules. Pure: no React, no server calls.

/** The name field has changed and isn't blank. */
export const nameChanged = (draft: string, current: string) => draft.trim() !== current && draft.trim().length > 0;

export function checkName(name: string): { ok: true; value: string } | { ok: false; error: string } {
  return name.trim() ? { ok: true, value: name.trim() } : { ok: false, error: "Name is required." };
}

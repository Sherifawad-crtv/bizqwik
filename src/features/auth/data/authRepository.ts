import { auth } from "../../../shared/api/backend";
import { callFn } from "../../../shared/api/core";
import type { BizqwikTeam, Profile } from "../../../shared/types";

// Data layer: the server calls the sign-in screens make. The auth client is
// shared (the app's session uses it), so it's wrapped; sign-up is auth-only.
export const authRepository = {
  /** Returns { profile } for an org staff signup, or { bizqwikTeam } for a
   * Bizqwik-team signup — decided by which invite the email matched. */
  signup: (name: string, email: string, password: string) =>
    callFn<{ profile?: Profile; bizqwikTeam?: BizqwikTeam }>("signup", { method: "POST", body: { name, email, password } }),
  sendPasswordReset: (email: string) => auth.sendPasswordReset(email),
  updatePassword: (password: string) => auth.updatePassword(password),
};

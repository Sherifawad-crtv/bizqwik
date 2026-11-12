// Real backend — talks to the "make-server-980e1cbf" Supabase edge function.
// Same auth/api/MOCK shape as the mock layer this replaced, so no screen
// needed to change: swap this one file to point elsewhere and everything
// keeps working (see supabaseClient.ts for which project it targets).
import { supabase } from "./supabaseClient";
import { accountApi } from "./api/account";
import { locationsApi } from "./api/locations";
import { deskApi } from "./api/desk";
import { servicesApi } from "./api/services";
import { classesApi } from "./api/classes";
import { rosterApi } from "./api/roster";
import { activityApi } from "./api/activity";
import { opsApi } from "./api/ops";
export { ApiError } from "./api/core";
export type { DropInOption, SeriesInput, PlanTypeInput, SalePartner, NewClientFields } from "./api/inputs";

export const auth = {
  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  },
  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },
};

export const api = {
  ...accountApi,
  ...locationsApi,
  ...deskApi,
  ...servicesApi,
  ...classesApi,
  ...rosterApi,
  ...activityApi,
  ...opsApi,
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const now = new Date();
const CURRENT_MONTH = monthKey(now);
// current month + the two before it, for the month switcher/segmented control
const MONTHS = [2, 1, 0].map((offset) => monthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1)));

export const MOCK = { CURRENT_MONTH, MONTHS };

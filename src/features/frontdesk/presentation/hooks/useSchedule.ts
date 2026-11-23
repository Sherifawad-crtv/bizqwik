import { useState } from "react";
import { useAsync } from "../../../../shared/api/useAsync";
import { useSave } from "../../../../shared/api/useSave";
import { todayIso } from "../../../../shared/format";
import { frontdeskRepository as repo } from "../../data/frontdeskRepository";
import { startOfDay } from "../../domain/calendar";
import { checkInvitation } from "../../domain/schedule";

// ---- Classes ---------------------------------------------------------------------

/** Classes from the start of today on (the Bookings list). */
export const useTodaysClasses = () => useAsync(() => repo.classes(startOfDay(new Date()).toISOString()), []);

/** Classes from `since` on (the calendar loads further back as it's paged). */
export const useClassesSince = (since: Date) => useAsync(() => repo.classes(since.toISOString()), [since.getTime()]);

export const cancelClass = (id: string) => repo.cancelClass(id);

// ---- Solo home ---------------------------------------------------------------------

export const useRevenue = () => useAsync(() => repo.revenue(12), []);
export const useSoloClasses = () => useAsync(() => repo.classes(new Date(Date.now() - 2 * 3600000).toISOString()), []);
export const useBundleTypes = () => useAsync(() => repo.bundleTypes(), []);
/** One location's payments by month (only with 2+ locations). */
export const useLocationRevenue = (here: string | null) => useAsync(() => (here ? repo.paymentsSummary(12, here) : Promise.resolve(null)), [here]);

// ---- InstaPay payment requests -------------------------------------------------------

export const usePaymentRequests = () => useAsync(() => repo.paymentRequests(), []);

/** Approve or reject one request; `onDone` runs after either worked. */
export function usePaymentDecision(id: string, onDone: () => void) {
  const { busy, error, run } = useSave();
  return {
    busy,
    error,
    approve: () => run(async () => {
      await repo.approvePayment(id);
      onDone();
    }),
    reject: (note: string) => run(async () => {
      await repo.rejectPayment(id, note);
      onDone();
    }),
  };
}

// ---- Guest invitations ------------------------------------------------------------------

/** Record a guest's visit on a member's plan. Resolves to the member's passes
 * left, or null when it didn't save. */
export function useInviteGuest() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invite = async (memberId: string, guestName: string, guestPhone: string, visitDate: string): Promise<number | null> => {
    const msg = checkInvitation(guestName, guestPhone, visitDate, todayIso());
    if (msg) {
      setError(msg);
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await repo.invite(memberId, guestName.trim(), guestPhone.trim(), visitDate);
      return res.invitationsRemaining;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, invite };
}

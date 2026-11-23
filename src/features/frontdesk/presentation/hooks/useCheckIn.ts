import { useEffect, useState } from "react";
import { useAsync } from "../../../../shared/api/useAsync";
import { ApiError } from "../../../../shared/api/backend";
import type { ClientWithPackage } from "../../../../shared/types";
import { frontdeskRepository as repo } from "../../data/frontdeskRepository";
import { hasActivePlan, sessionsLeft, usedUpMessage } from "../../domain/checkIn";

type Left = ReturnType<typeof sessionsLeft>;

// ---- Reads -------------------------------------------------------------------

export const useFrontDeskSummary = () => useAsync(() => repo.frontDeskSummary(), []);

/** Classes from 2 hours ago on: what the desk's home lists as next up. */
export const useUpcomingClasses = () => useAsync(() => repo.classes(new Date(Date.now() - 2 * 3600000).toISOString()), []);

// ---- Writes --------------------------------------------------------------------

/** The check-in sheet: confirm one client's check-in. `usedUp` says why a
 * client whose bundle ran out can't check in (looked up when the sheet opens,
 * or the server's answer to a check-in). `confirm` resolves to the sessions
 * left (or null), or `false` when it didn't check in. */
export function useConfirmCheckIn(client: ClientWithPackage | null, locationId: string | undefined) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedUp, setUsedUp] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    setError(null);
    setUsedUp(null);
    if (hasActivePlan(client)) return;
    let alive = true;
    repo.clientPlans(client.id).then((r) => {
      const msg = usedUpMessage(client.name, r.plans, Date.now());
      if (alive && msg) setUsedUp(msg);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [client]);

  const confirm = async (clientId: string): Promise<Left | false> => {
    setBusy(true);
    setError(null);
    try {
      return sessionsLeft(await repo.checkIn(clientId, "manual", locationId));
    } catch (err) {
      if (err instanceof ApiError && err.code === "no_sessions") setUsedUp(err.message);
      else setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, usedUp, clearUsedUp: () => setUsedUp(null), confirm };
}

export type QuickResult = { state: "busy" } | { state: "done"; note: string } | { state: "error"; text: string };

/** One-tap check-ins from a list: each row keeps its own result. `note` words
 * the sessions left for that list. */
export function useQuickCheckIn(locationId: string | undefined, note: (left: Left) => string) {
  const [results, setResults] = useState<Record<string, QuickResult>>({});
  const checkIn = async (c: ClientWithPackage) => {
    setResults((r) => ({ ...r, [c.id]: { state: "busy" } }));
    try {
      const left = sessionsLeft(await repo.checkIn(c.id, "manual", locationId));
      setResults((r) => ({ ...r, [c.id]: { state: "done", note: note(left) } }));
    } catch (err) {
      setResults((r) => ({ ...r, [c.id]: { state: "error", text: err instanceof Error ? err.message : "Couldn't check in." } }));
    }
  };
  return { results, checkIn };
}

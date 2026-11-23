import { useState } from "react";
import { useAsync } from "../../../../shared/api/useAsync";
import { ApiError } from "../../../../shared/api/backend";
import { frontdeskRepository as repo } from "../../data/frontdeskRepository";
import { checkDropIn, dropInDoneLabel, effectivePay, type DropInSale } from "../../domain/dropIn";

// ---- Reads -------------------------------------------------------------------

export const useDropInClasses = () => useAsync(() => repo.classes(), []);

/** The client list, loaded only while the picker is open. */
export const usePickableClients = (open: boolean) => useAsync(() => (open ? repo.clients() : Promise.resolve(null)), [open]);

export const useOrgSettings = () => useAsync(() => repo.orgSettings(), []);

// ---- Writes --------------------------------------------------------------------

/** Record a drop-in. A member with a plan still running gets the same "are you
 * sure?" as the member app: `confirmPlan` holds that question, and
 * `chargeAnyway` re-sends once the desk has acknowledged it. */
export function useDropIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);

  // Records the sale; throws on failure. Resolves to the line shown once recorded.
  const record = async (s: DropInSale, confirmed: boolean): Promise<string> => {
    const pay = effectivePay(s.pay, !!s.client);
    if (s.mode === "class" && s.client && s.session) {
      await repo.classDropIn(s.client.id, s.session.id, pay, confirmed);
    } else {
      const member = s.client ? { clientId: s.client.id } : { newClient: { name: s.newName.trim(), phone: s.newPhone.trim(), email: s.newEmail.trim().toLowerCase() } };
      await repo.dropIn(member, s.category.trim(), Number(s.price), pay, confirmed);
    }
    return dropInDoneLabel(s);
  };

  const submit = async (s: DropInSale, onRecorded: (label: string) => void) => {
    setError(null);
    const msg = checkDropIn(s);
    if (msg) return setError(msg);
    setBusy(true);
    try {
      onRecorded(await record(s, false));
    } catch (err) {
      if (err instanceof ApiError && err.code === "active_plan_confirm") setConfirmPlan(err.message);
      else setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const chargeAnyway = async (s: DropInSale, onRecorded: (label: string) => void) => onRecorded(await record(s, true));

  return { busy, error, setError, confirmPlan, closeConfirm: () => setConfirmPlan(null), submit, chargeAnyway };
}

/** The solo owner's drop-in. Resolves to true when it was recorded. */
export function useSoloDropIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const record = async (method: "cash" | "instapay", here: string | null, kind: string | undefined): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await repo.soloDropIn(method, here, kind);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't record the drop-in.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, record };
}

import { useState } from "react";

/** Busy / error state around a save. `run` returns true when the save
 * succeeded; a failure shows its message in `error`. Pass `{ rethrow: true }`
 * to let the error propagate instead of showing it. */
export function useSave() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (save: () => Promise<unknown>, opts?: { rethrow?: boolean }): Promise<boolean> => {
    setBusy(true);
    if (!opts?.rethrow) setError(null);
    try {
      await save();
      return true;
    } catch (err) {
      if (opts?.rethrow) throw err;
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

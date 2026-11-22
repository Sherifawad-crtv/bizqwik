import { useState } from "react";

/** Busy / error state around a save. `run` returns true when the save
 * succeeded; a failure shows its message in `error`. Pass `{ rethrow: true }`
 * to let the error propagate instead of showing it. `fallback` is shown when
 * the error has no message of its own. */
export function useSave(fallback = "Something went wrong.") {
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
      setError(err instanceof Error ? err.message : fallback);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

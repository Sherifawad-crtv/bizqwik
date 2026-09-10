import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getVersion, subscribe } from "./bus";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * The one shared data-fetching pattern for the app. Every screen reads its
 * data through this hook instead of hand-rolling its own effect/fetch/state.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { refetch: () => void; mutate: (updater: T | ((prev: T | null) => T)) => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [tick, setTick] = useState(0);
  // any mutation anywhere in the app (settle, pay, addSession, …) bumps this,
  // so every mounted useAsync revalidates together — no stale screens.
  const dataVersion = useSyncExternalStore(subscribe, getVersion, getVersion);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (alive) setState({ data: null, loading: false, error: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, dataVersion]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  // Lets a caller update the cached data immediately (an optimistic UI
  // change) without waiting on a round-trip. The next refetch — triggered
  // by the mutation's own bump() — reconciles it with the real server data.
  const mutate = useCallback((updater: T | ((prev: T | null) => T)) => {
    setState((s) => ({ ...s, data: typeof updater === "function" ? (updater as (prev: T | null) => T)(s.data) : updater }));
  }, []);
  return { ...state, refetch, mutate };
}

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getVersion, subscribe } from "./bus";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// No caching: every screen always fetches fresh data from the server. The
// only sharing is between identical requests made at the very same moment
// (e.g. two parts of one screen asking for the client list), which get one
// round trip and the same fresh answer.
const inflight = new Map<string, Promise<unknown>>();
export function clearAsyncCache() {
  inflight.clear();
}

// How many screen loads are in progress, so pull-to-refresh can keep its
// spinner up until the refresh has actually landed.
let active = 0;
export async function waitForLoadsToFinish(maxMs = 10000) {
  // Let the refreshed screens start their requests first.
  await new Promise((r) => setTimeout(r, 50));
  const until = Date.now() + maxMs;
  while (active > 0 && Date.now() < until) await new Promise((r) => setTimeout(r, 80));
}
function keyOf(fn: () => unknown, deps: unknown[]): string {
  try {
    return `${fn.toString()}|${JSON.stringify(deps)}`;
  } catch {
    return `${fn.toString()}|${Math.random()}`;
  }
}

/**
 * The one shared data-fetching pattern for the app. Every screen reads its
 * data through this hook instead of hand-rolling its own effect/fetch/state.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { refetch: () => void; mutate: (updater: T | ((prev: T | null) => T)) => void } {
  const key = keyOf(fn, deps);
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
    const flight = `${key}@${dataVersion}@${tick}`;
    let req = inflight.get(flight) as Promise<T> | undefined;
    if (!req) {
      req = fnRef.current();
      inflight.set(flight, req);
      active++;
      const done = () => {
        inflight.delete(flight);
        active--;
      };
      req.then(done, done);
    }
    req
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

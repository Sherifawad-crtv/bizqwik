import { useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";

// What each screen was last showing, kept for the session so leaving a screen
// (to open a coach, or switch tabs) and coming back finds it as it was left.
const memory = new Map<string, string>();

/** Like useState, but the value survives leaving and returning to the screen.
 * With `url`, it also lives in the address (?key=value) so Back, Refresh and
 * shared links land on the same view; the address wins over memory. */
export function useSticky<T extends string>(key: string, initial: T, opts: { url?: boolean; valid?: (v: string) => boolean } = {}): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams();
  const ok = (v: string | null | undefined): v is T => !!v && (opts.valid ? opts.valid(v) : true);
  const fromUrl = opts.url ? params.get(key) : null;
  const [local, setLocal] = useState<T>(() => (ok(fromUrl) ? fromUrl : ok(memory.get(key)) ? (memory.get(key) as T) : initial));
  const value = opts.url && ok(fromUrl) ? fromUrl : local;
  const set = useCallback(
    (v: T) => {
      memory.set(key, v);
      setLocal(v);
      if (opts.url) {
        const next = new URLSearchParams(window.location.search);
        next.set(key, v);
        setParams(next, { replace: true });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, opts.url],
  );
  return [value, set];
}

/** Sets what a screen will show the next time it opens (e.g. the Members filter
 * a Home card links into). */
export function setSticky(key: string, value: string): void {
  memory.set(key, value);
}

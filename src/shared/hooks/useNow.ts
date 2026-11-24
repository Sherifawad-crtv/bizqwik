import { useEffect, useState } from "react";

/** The current time, as a value that is stable within a render and moves
 * forward once a minute — for "what's next", "days left" and the like.
 * (Calling Date.now() while rendering gives a different answer each render,
 * and a memo that did so would never move on.) */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

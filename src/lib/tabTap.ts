let lastTabTap = 0;

/** The bottom bar calls this on a tab tap, so the screen mover can tell "a tab
 * was tapped" (a fade) from "a screen was opened" (a slide). */
export function noteTabTap() {
  lastTabTap = Date.now();
}

/** Milliseconds since the last tab tap. */
export function sinceTabTap() {
  return Date.now() - lastTabTap;
}

import { useLayoutEffect, useRef } from "react";
import { STANDARD_MS } from "../motion/motion";
/** A small spinner for a part of a screen that is loading (a list inside a
 * sheet, a tab's content). Whole screens use <Spinner /> below, which shows
 * the shape of the screen instead. */
export function InlineSpinner() {
  return (
    <div className="bq-spinner-inline-spinner-row">
      <div className="bq-spinner-inline-spinner-box"
      />
    </div>
  );
}

const block = (w: string | number, h: number, r = 999) => (
  <div className="bq-skel bq-spinner-block-box" style={{ width: w, height: h, borderRadius: r }} />
);

/** What a whole screen shows while its data loads: the shape of a list, so the
 * content settles into place instead of popping in. Keeps the name Spinner so
 * every screen gets it. */
export function Spinner() {
  // When the real content takes the placeholder's place, it fades in instead of
  // popping: on the way out the placeholder marks its container, and CSS fades
  // whatever arrives there (see [data-reveal] in design-system/base.css).
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      const host = el?.parentElement;
      if (!host) return;
      host.setAttribute("data-reveal", "");
      window.setTimeout(() => host.removeAttribute("data-reveal"), STANDARD_MS + 80);
    };
  }, []);
  return (
    <div className="bq-spinner-stack" ref={ref} role="status" aria-label="Loading" aria-busy="true" data-testid="skeleton">
      {block("42%", 22, 999)}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="bq-card bq-spinner-row">
          {block(44, 44, 999)}
          <div className="bq-flex-1 bq-flex bq-col bq-gap-2">
            {block(i % 2 ? "55%" : "70%", 14, 999)}
            {block("38%", 12, 999)}
          </div>
        </div>
      ))}
    </div>
  );
}

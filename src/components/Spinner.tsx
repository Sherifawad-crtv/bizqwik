import { useLayoutEffect, useRef } from "react";
import { STANDARD_MS } from "../lib/motion";
/** A small spinner for a part of a screen that is loading (a list inside a
 * sheet, a tab's content). Whole screens use <Spinner /> below, which shows
 * the shape of the screen instead. */
export function InlineSpinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40svh" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: "3px solid var(--primary-tint)",
          borderTopColor: "var(--primary)",
          animation: "bqSpin .7s linear infinite",
        }}
      />
    </div>
  );
}

const block = (w: string | number, h: number, r = 999) => (
  <div className="bq-skel" style={{ width: w, height: h, borderRadius: r, background: "var(--line)" }} />
);

/** What a whole screen shows while its data loads: the shape of a list, so the
 * content settles into place instead of popping in. Keeps the name Spinner so
 * every screen gets it. */
export function Spinner() {
  // When the real content takes the placeholder's place, it fades in instead of
  // popping: on the way out the placeholder marks its container, and CSS fades
  // whatever arrives there (see [data-reveal] in index.css).
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
    <div ref={ref} role="status" aria-label="Loading" aria-busy="true" data-testid="skeleton" style={{ padding: "8px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
      {block("42%", 22, 999)}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderRadius: "var(--r-card)", background: "var(--surface)" }}>
          {block(44, 44, 999)}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {block(i % 2 ? "55%" : "70%", 14, 999)}
            {block("38%", 12, 999)}
          </div>
        </div>
      ))}
    </div>
  );
}

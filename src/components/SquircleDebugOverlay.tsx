import { useEffect, useState } from "react";

// Temporary, query-param-gated (?squircle-debug) diagnostic panel — visit
// it on the actual device that isn't showing squircle corners. Renders two
// otherwise-identical test boxes: one plain, one inside a container with
// `-webkit-overflow-scrolling: touch` (exactly what the real app's
// scrollable screens use) — a documented WebKit quirk can silently break
// clip-path rendering only inside that kind of momentum-scroll container,
// even though getComputedStyle still reports the clip-path as applied.
// If the plain box looks squircled but the scroll-wrapped one doesn't,
// that's the bug. Delete this whole file once the iOS report is resolved.
export function SquircleDebugOverlay() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const box = (dataAttr: string) => (
    <div data-sq {...{ [dataAttr]: "" }} style={{ width: 120, height: 120, borderRadius: 24, background: "#5a41ff", flex: "none" }} />
  );

  // A plain rounded-rect at the SAME radius, deliberately with no data-sq
  // (so no clip-path at all) — a direct side-by-side against the squircle
  // box above it. At a small radius relative to size, a superellipse (n=4)
  // and a circular corner (n=2) look nearly identical, which may be the
  // whole story: the polyfill could be working fine and just too subtle to
  // notice next to plain border-radius, especially at real card sizes
  // (16-28px radius on 300-360px wide cards — a far smaller ratio than the
  // 24px-on-120px boxes here, which already exaggerate the effect).
  const plainRounded = (
    <div style={{ width: 120, height: 120, borderRadius: 24, background: "#177a4b", flex: "none" }} />
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#fff", overflow: "auto", padding: 20, font: "13px/1.5 monospace" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Squircle diagnostics</div>
      <div style={{ color: "#888", marginBottom: 16 }}>All three should look the same shape as each other if the polyfill is working — box 3 (green) is a PLAIN rounded rect for comparison, not a squircle.</div>

      <div style={{ marginBottom: 8, fontWeight: 700 }}>1. Plain box (squircle)</div>
      {box("data-box-plain")}

      <div style={{ margin: "20px 0 8px", fontWeight: 700 }}>2. Inside a -webkit-overflow-scrolling: touch container (squircle)</div>
      <div style={{ height: 150, overflowY: "auto", WebkitOverflowScrolling: "touch", border: "1px dashed #ccc", padding: 15 }}>
        {box("data-box-scroll")}
      </div>

      <div style={{ margin: "20px 0 8px", fontWeight: 700 }}>3. Plain rounded rect, NOT a squircle (reference)</div>
      {plainRounded}

      <div style={{ margin: "20px 0 8px", fontWeight: 700 }}>4. Big-radius side by side (app-icon-style ratio — squircle left, plain right)</div>
      <div style={{ display: "flex", gap: 16 }}>
        <div data-sq style={{ width: 150, height: 150, borderRadius: 55, background: "#5a41ff", flex: "none" }} />
        <div style={{ width: 150, height: 150, borderRadius: 55, background: "#177a4b", flex: "none" }} />
      </div>

      <div style={{ marginTop: 20 }}>
        {ready ? <Readout /> : <div>measuring…</div>}
      </div>
    </div>
  );
}

function Readout() {
  const plain = document.querySelector<HTMLElement>("[data-box-plain]");
  const scroll = document.querySelector<HTMLElement>("[data-box-scroll]");
  const describe = (el: HTMLElement | null) => {
    if (!el) return "not found";
    const cs = getComputedStyle(el);
    return `clip-path: ${cs.clipPath === "none" ? "none" : "polygon(...) [applied]"}`;
  };
  return (
    <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
{`userAgent:
${navigator.userAgent}

CSS.supports("corner-shape","squircle"):
${typeof CSS !== "undefined" && !!CSS.supports && CSS.supports("corner-shape", "squircle")}

plain box — ${describe(plain)}

scroll-wrapped box — ${describe(scroll)}`}
    </pre>
  );
}

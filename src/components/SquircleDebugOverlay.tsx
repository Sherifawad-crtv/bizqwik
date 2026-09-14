import { useEffect, useState } from "react";

interface Diagnostics {
  ua: string;
  nativeSupported: boolean;
  borderRadius: string;
  clipPath: string;
}

// Temporary, query-param-gated (?squircle-debug) diagnostic panel — visit
// it on the actual device that isn't showing squircle corners to see, on
// that device itself, whether native support is being (mis)detected or the
// polyfill's clip-path just isn't landing. Delete once the iOS report is
// resolved.
export function SquircleDebugOverlay() {
  const [diag, setDiag] = useState<Diagnostics | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>("[data-squircle-debug-box]");
      if (!el) return;
      const cs = getComputedStyle(el);
      setDiag({
        ua: navigator.userAgent,
        nativeSupported: typeof CSS !== "undefined" && !!CSS.supports && CSS.supports("corner-shape", "squircle"),
        borderRadius: cs.borderTopLeftRadius,
        clipPath: cs.clipPath,
      });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "#fff", overflow: "auto", padding: 20, font: "13px/1.5 monospace" }}>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Squircle diagnostics</div>
      <div data-sq data-squircle-debug-box style={{ width: 140, height: 140, borderRadius: 28, background: "#5a41ff", marginBottom: 16 }} />
      {diag ? (
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
{`userAgent:
${diag.ua}

CSS.supports("corner-shape","squircle"):
${diag.nativeSupported}

computed border-top-left-radius:
${diag.borderRadius}

computed clip-path:
${diag.clipPath}`}
        </pre>
      ) : (
        <div>measuring…</div>
      )}
    </div>
  );
}

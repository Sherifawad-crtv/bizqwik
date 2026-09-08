import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useOutlet } from "react-router-dom";

/** Routes reached by drilling in from a tab, not by switching tabs — these get
 * an iOS-style push/pop slide. Tab-to-tab switches stay instant, matching how
 * a real iOS tab bar behaves (it never animates). */
function isPushRoute(pathname: string): boolean {
  return pathname === "/account" || /^\/coaches\/[^/]+$/.test(pathname);
}

interface Slot {
  pathname: string;
  outlet: ReactNode;
}

interface PushSlot extends Slot {
  entered: boolean;
  leaving: boolean;
}

const EXIT_MS = 340;

const layerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  padding: "calc(86px + var(--safe-top)) 16px calc(150px + var(--safe-bottom))",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  background: "var(--paper)",
};

export function RouteTransition() {
  const location = useLocation();
  const outlet = useOutlet();

  const [tab, setTab] = useState<Slot>(() => ({ pathname: location.pathname, outlet }));
  const [push, setPush] = useState<PushSlot | null>(null);
  const exitTimer = useRef<number | undefined>(undefined);
  const enterFrame = useRef<number | undefined>(undefined);

  useEffect(() => {
    const path = location.pathname;

    if (isPushRoute(path)) {
      clearTimeout(exitTimer.current);
      setPush({ pathname: path, outlet, entered: false, leaving: false });
      return;
    }

    setTab({ pathname: path, outlet });
    setPush((p) => (p ? { ...p, leaving: true } : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!push || push.entered || push.leaving) return;
    cancelAnimationFrame(enterFrame.current!);
    enterFrame.current = requestAnimationFrame(() => {
      enterFrame.current = requestAnimationFrame(() => {
        setPush((p) => (p && !p.leaving ? { ...p, entered: true } : p));
      });
    });
    return () => cancelAnimationFrame(enterFrame.current!);
  }, [push]);

  useEffect(() => {
    if (!push?.leaving) return;
    exitTimer.current = window.setTimeout(() => setPush(null), EXIT_MS);
    return () => clearTimeout(exitTimer.current);
  }, [push?.leaving]);

  if (!push) return <div data-scroll style={layerStyle}>{tab.outlet}</div>;

  const shown = push.entered && !push.leaving;

  return (
    <div style={{ position: "relative", height: "100%", overflow: "hidden" }}>
      <div data-scroll style={layerStyle}>
        {tab.outlet}
      </div>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,.14)",
          opacity: shown ? 1 : 0,
          transition: "opacity .34s cubic-bezier(.32,.72,0,1)",
          pointerEvents: "none",
        }}
      />
      <div
        data-scroll
        style={{
          ...layerStyle,
          boxShadow: shown ? "-8px 0 24px rgba(0,0,0,.12)" : "none",
          transform: shown ? "translateX(0)" : "translateX(100%)",
          transition: "transform .34s cubic-bezier(.32,.72,0,1)",
        }}
      >
        {push.outlet}
      </div>
    </div>
  );
}

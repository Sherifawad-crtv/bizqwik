import { useEffect, useRef, useState, type ReactNode } from "react";
import { bump } from "../lib/bus";
import { waitForLoadsToFinish } from "../lib/useAsync";
import { Icon } from "./Icon";

const TRIGGER = 72; // how far (px) to pull before letting go refreshes
const MAX = 110;

/** Mobile pull-down-to-refresh for every screen: pull from the top of the
 * page and let go to reload everything that's on screen from the server. */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const state = useRef({ startY: 0, startX: 0, tracking: false, pulling: false, dist: 0, busy: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = state.current;

    const onStart = (e: TouchEvent) => {
      if (s.busy || e.touches.length !== 1) return;
      const target = e.target as HTMLElement;
      const scroller = target.closest<HTMLElement>("[data-scroll]");
      // Only from the very top of the page, and never from inside a field.
      if (!scroller || scroller.scrollTop > 0 || target.closest("input, textarea, select, [data-no-ptr]")) return;
      s.tracking = true;
      s.pulling = false;
      s.startY = e.touches[0].clientY;
      s.startX = e.touches[0].clientX;
      s.dist = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!s.tracking) return;
      const dy = e.touches[0].clientY - s.startY;
      const dx = e.touches[0].clientX - s.startX;
      if (!s.pulling) {
        // A sideways swipe or an upward scroll isn't a pull.
        if (dy < 8 || Math.abs(dx) > dy) {
          if (dy < 0 || Math.abs(dx) > 10) s.tracking = false;
          return;
        }
        s.pulling = true;
        setDragging(true);
      }
      e.preventDefault();
      s.dist = Math.min(MAX, (dy - 8) * 0.5);
      setPull(s.dist);
    };
    const onEnd = async () => {
      if (!s.tracking) return;
      s.tracking = false;
      if (!s.pulling) return;
      s.pulling = false;
      setDragging(false);
      if (s.dist < TRIGGER) {
        setPull(0);
        return;
      }
      s.busy = true;
      setRefreshing(true);
      setPull(TRIGGER * 0.75);
      const started = Date.now();
      bump();
      await waitForLoadsToFinish();
      const left = 500 - (Date.now() - started);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      setRefreshing(false);
      setPull(0);
      s.busy = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd);
    el.addEventListener("touchcancel", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const shown = pull > 0 || refreshing;
  const ready = pull >= TRIGGER;
  return (
    <div ref={ref} style={{ position: "relative", height: "100%" }}>
      <div
        aria-hidden={!shown}
        data-testid="ptr"
        style={{
          position: "absolute",
          left: "50%",
          top: "calc(var(--safe-top) + 6px)",
          zIndex: 60,
          width: 40,
          height: 40,
          marginLeft: -20,
          borderRadius: 999,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "0 4px 14px rgba(0,0,0,.12)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: ready || refreshing ? "var(--primary-pressed)" : "var(--ink-muted)",
          transform: `translateY(${shown ? pull : -60}px)`,
          opacity: shown ? Math.min(1, pull / 40 + (refreshing ? 1 : 0)) : 0,
          transition: dragging ? "none" : "transform .25s ease, opacity .25s ease",
          pointerEvents: "none",
        }}
      >
        {refreshing ? (
          <span className="bq-ptr-spin" style={{ width: 18, height: 18, borderRadius: 999, border: "2.5px solid var(--primary-tint)", borderTopColor: "var(--primary-pressed)" }} />
        ) : (
          <span style={{ display: "flex", transform: `rotate(${ready ? 180 : 0}deg)`, transition: "transform .2s ease" }}>
            <Icon name="chevron-down" size={20} />
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

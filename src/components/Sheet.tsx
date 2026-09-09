import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "../lib/useIsMobile";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

// Settle covers both the entrance arriving at rest and a drag-dismiss
// snapping back — both are "coming to a stop" motions. Exit covers both a
// drag past the threshold and a programmatic close (backdrop tap, Cancel,
// a save action) — both are the sheet leaving.
const SETTLE_MS = 340;
const SETTLE_EASE = "cubic-bezier(.16,1,.3,1)";
const EXIT_MS = 260;
const EXIT_EASE = "cubic-bezier(.4,0,1,1)";

type Phase = "opening" | "open" | "closing";

export function Sheet({ open, onClose, children, width = 460 }: SheetProps) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(open);
  const [phase, setPhase] = useState<Phase>(open ? "opening" : "closing");
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const y0 = useRef(0);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setDragY(0);
      setPhase("opening");
      // A single rAF can still land in the same paint as this render (React
      // batches them), so the "opening" transform never actually hits the
      // screen to transition from. Nesting a second rAF guarantees a real
      // paint happens first.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPhase("open"));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setPhase("closing");
    const t = window.setTimeout(() => setVisible(false), EXIT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!visible) return null;

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const dragStart = (e: React.PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    y0.current = e.clientY;
    setDragging(true);
  };
  const dragMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const d = e.clientY - y0.current;
    setDragY(d > 0 ? d : d / 6);
  };
  const dragEnd = () => {
    setDragging(false);
    if (dragY > 150) {
      onClose(); // sheet keeps sliding from its dragged position to fully off-screen
    } else {
      setDragY(0);
    }
  };

  if (isMobile) {
    const transform = dragging ? `translateY(${dragY}px)` : phase === "open" ? "translateY(0)" : "translateY(100%)";
    const transition = dragging
      ? "none"
      : phase === "opening"
        ? "none"
        : phase === "closing"
          ? `transform ${EXIT_MS}ms ${EXIT_EASE}`
          : `transform ${SETTLE_MS}ms ${SETTLE_EASE}`;

    return createPortal(
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(26,23,38,.34)",
        }}
      >
        <div
          onClick={stop}
          data-sq
          style={{
            position: "absolute",
            left: "calc(8px + var(--safe-left))",
            right: "calc(8px + var(--safe-right))",
            bottom: "calc(8px + var(--safe-bottom))",
            maxHeight: "calc(88svh - 16px)",
            display: "flex",
            flexDirection: "column",
            background: "var(--surface)",
            borderRadius: "var(--r-card)",
            border: "1px solid var(--line)",
            boxShadow: "var(--shadow-float)",
            padding: "10px 20px 20px",
            transform,
            transition,
            touchAction: "none",
          }}
        >
          <div onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} style={{ padding: "8px 0 14px", cursor: "grab", touchAction: "none", flex: "none" }}>
            <div style={{ width: 44, height: 5, borderRadius: 999, background: "var(--line)", margin: "0 auto" }} />
          </div>
          <div data-scroll style={{ overflowY: "auto" }}>
            {children}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(26,23,38,.34)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "bqFade .18s ease",
      }}
    >
      <div
        onClick={stop}
        data-sq
        style={{
          width: `min(${width}px, 90vw)`,
          maxHeight: "88vh",
          overflowY: "auto",
          background: "var(--surface)",
          borderRadius: "var(--r-card)",
          border: "1px solid var(--line)",
          padding: 26,
          animation: "bqPop .18s ease",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

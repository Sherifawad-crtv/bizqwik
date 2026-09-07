import { useRef, useState, type ReactNode } from "react";
import { useIsMobile } from "../lib/useIsMobile";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

export function Sheet({ open, onClose, children, width = 460 }: SheetProps) {
  const isMobile = useIsMobile();
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const y0 = useRef(0);

  if (!open) return null;

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
    const close = dragY > 150;
    setDragging(false);
    setDragY(0);
    if (close) onClose();
  };

  if (isMobile) {
    return (
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(26,23,38,.34)",
          animation: "bqFade .2s ease",
        }}
      >
        <div
          onClick={stop}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: "88svh",
            display: "flex",
            flexDirection: "column",
            background: "var(--surface)",
            borderRadius: "28px 28px 0 0",
            borderTop: "1px solid var(--line)",
            padding: "10px 20px calc(28px + var(--safe-bottom))",
            transform: `translateY(${dragY}px)`,
            transition: dragging ? "none" : "transform .28s cubic-bezier(.22,1,.36,1)",
            animation: "bqSheetIn .28s cubic-bezier(.22,1,.36,1)",
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
      </div>
    );
  }

  return (
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
    </div>
  );
}

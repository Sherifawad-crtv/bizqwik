import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "../lib/useIsMobile";
import { Button } from "./Button";
import { EASE, SHEET_IN_MS, SHEET_OUT_MS } from "../lib/motion";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}

// How a sheet leaves, the way iOS does it: past a third of its height, or
// thrown downward fast enough, it goes; otherwise it springs back.
const DISMISS_FRACTION = 1 / 3;
const DISMISS_VELOCITY = 0.5; // px per ms

type Phase = "opening" | "open" | "closing";

// Open sheets, oldest first, so Escape only closes the top one.
const openStack: symbol[] = [];

/** The sheet's own ways to leave — backdrop tap, swipe down, Escape — all come
 * through here. If something has been typed and not saved, it asks first
 * (the Cancel / Save buttons inside a sheet call onClose directly and never ask). */
export function Sheet({ open, onClose, children, width = 460 }: SheetProps) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(open);
  const [phase, setPhase] = useState<Phase>(open ? "opening" : "closing");
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [asking, setAsking] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const id = useRef(Symbol("sheet"));
  const drag = useRef({ active: false, startY: 0, y: 0, samples: [] as { y: number; t: number }[] });

  const requestDismiss = () => {
    // A saved or confirmed state (the checkmark) is never "unsaved".
    if (dirty.current && !rootRef.current?.querySelector("[data-sheet-clean]")) {
      setAsking(true);
      return;
    }
    onClose();
  };

  const startDrag = (clientY: number) => {
    const d = drag.current;
    d.active = true;
    d.startY = clientY;
    d.samples = [{ y: clientY, t: performance.now() }];
    d.y = 0;
    setDragging(true);
  };
  const moveDrag = (clientY: number) => {
    const d = drag.current;
    if (!d.active) return;
    const t = performance.now();
    d.samples.push({ y: clientY, t });
    d.samples = d.samples.filter((s) => t - s.t <= 100); // only the last ~100 ms say how fast it was thrown
    const dy = clientY - d.startY;
    d.y = dy > 0 ? dy : dy / 6; // pulling up resists
    setDragY(d.y);
  };
  const endDrag = () => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    setDragging(false);
    const h = panelRef.current?.offsetHeight ?? 400;
    // Speed over the last ~100 ms; a finger that had stopped before letting go isn't a flick.
    const now = performance.now();
    const recent = d.samples.filter((s) => now - s.t <= 100);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const v = first && last && last.t - first.t >= 16 && now - last.t <= 100 ? (last.y - first.y) / (last.t - first.t) : 0;
    if (d.y > h * DISMISS_FRACTION || v > DISMISS_VELOCITY) {
      if (dirty.current && !rootRef.current?.querySelector("[data-sheet-clean]")) {
        setDragY(0); // settle back, then ask
        setAsking(true);
      } else {
        onClose(); // the sheet keeps travelling from where it was let go
      }
    } else {
      setDragY(0);
    }
  };
  // The listeners below are attached once; they call whatever is current.
  const live = useRef({ startDrag, moveDrag, endDrag });
  live.current = { startDrag, moveDrag, endDrag };

  useEffect(() => {
    if (open) {
      if (!openStack.includes(id.current)) openStack.push(id.current);
      opener.current = document.activeElement as HTMLElement | null;
      dirty.current = false;
      setAsking(false);
      setVisible(true);
      setDragY(0);
      setPhase("opening");
      // A single rAF can still land in the same paint as this render (React
      // batches them), so the "opening" transform never actually hits the
      // screen to transition from. Nesting a second rAF guarantees a real
      // paint happens first.
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setPhase("open");
          rootRef.current?.focus({ preventScroll: true });
        });
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setPhase("closing");
    setAsking(false);
    const at = openStack.indexOf(id.current);
    if (at >= 0) openStack.splice(at, 1);
    opener.current?.focus?.({ preventScroll: true });
    // Unmount exactly when the close transition actually finishes, rather
    // than guessing a fixed delay that can cut it off a frame early (reads
    // as an abrupt pop) — with a fallback timer in case the event is ever
    // missed (e.g. the transition gets interrupted).
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setVisible(false);
    };
    const el = panelRef.current;
    const onEnd = (e: TransitionEvent) => {
      // Only the panel's own slide counts — a button inside it finishing its own
      // little press animation bubbles up here too.
      if (e.target === el && e.propertyName === "transform") finish();
    };
    el?.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(finish, SHEET_OUT_MS + 150);
    return () => {
      el?.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes the top sheet (and a pending "discard?" first).
  useEffect(() => {
    if (!visible || !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || openStack[openStack.length - 1] !== id.current) return;
      e.stopPropagation();
      if (asking) setAsking(false);
      else requestDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Swiping down on the sheet's content dismisses it too — but only once the
  // content is scrolled to the top, so scrolling a long sheet still scrolls.
  useEffect(() => {
    if (!visible || !isMobile) return;
    const el = scrollRef.current;
    if (!el) return;
    let startY = 0;
    let tracking = false;
    let pulling = false;
    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      tracking = e.touches.length === 1 && el.scrollTop <= 0 && !target.closest("input, textarea, select, [data-no-drag]");
      pulling = false;
      startY = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (!pulling) {
        if (dy < -4) tracking = false; // scrolling up
        if (dy <= 8 || !tracking) return;
        pulling = true;
        live.current.startDrag(startY + 8);
      }
      e.preventDefault();
      live.current.moveDrag(y);
    };
    const onEnd = () => {
      if (pulling) live.current.endDrag();
      pulling = false;
      tracking = false;
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
  }, [visible, isMobile]);

  if (!visible) return null;

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const noteTyping = (e: React.FormEvent) => {
    const t = e.target as HTMLElement;
    // Typing in a search box isn't work worth saving.
    if (t.matches?.("input, textarea") && !t.matches("[type=search], [data-no-dirty]")) dirty.current = true;
  };

  const discardPrompt = asking && (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setAsking(false);
      }}
      style={{ position: "absolute", inset: 0, zIndex: 2, background: "rgba(26,23,38,.34)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? "0 8px calc(8px + var(--safe-bottom))" : 0, animation: "bqFade .18s ease" }}
    >
      <div role="alertdialog" aria-modal="true" aria-label="Discard changes?" onClick={stop} style={{ width: "100%", maxWidth: 420, background: "var(--surface)", borderRadius: 28, border: "1px solid var(--line)", padding: 20, animation: "bqRise .22s ease" }}>
        <div style={{ font: "800 20px var(--font-body)", letterSpacing: "-.01em" }}>Discard changes?</div>
        <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", margin: "4px 0 16px" }}>What you've entered here won't be saved.</div>
        <Button variant="danger" fullWidth onClick={() => { dirty.current = false; setAsking(false); onClose(); }}>
          Discard changes
        </Button>
        <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={() => setAsking(false)}>
          Keep editing
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    const transform = dragging ? `translateY(${dragY}px)` : phase === "open" ? "translateY(0)" : "translateY(100%)";
    const transition = dragging || phase === "opening" ? "none" : `transform ${phase === "closing" ? SHEET_OUT_MS : SHEET_IN_MS}ms ${EASE}`;
    const h = panelRef.current?.offsetHeight ?? 400;
    // The dark layer follows the sheet: it fades in as the sheet rises, out as
    // it leaves, and lightens as you pull it down.
    const backdropOpacity = dragging ? Math.max(0, 1 - Math.max(0, dragY) / h) : phase === "open" ? 1 : 0;
    const backdropTransition = dragging || phase === "opening" ? "none" : `opacity ${phase === "closing" ? SHEET_OUT_MS : SHEET_IN_MS}ms ${EASE}`;

    return createPortal(
      <div ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" onClick={requestDismiss} onInput={noteTyping} style={{ position: "fixed", inset: 0, zIndex: 200, outline: "none" }}>
        <div data-testid="sheet-backdrop" aria-hidden style={{ position: "absolute", inset: 0, background: "rgba(26,23,38,.34)", opacity: backdropOpacity, transition: backdropTransition, touchAction: "none" }} />
        <div
          ref={panelRef}
          onClick={stop}
          style={{
            position: "absolute",
            left: "calc(8px + var(--safe-left))",
            right: "calc(8px + var(--safe-right))",
            bottom: "8px",
            maxHeight: "calc(88svh - 16px)",
            display: "flex",
            flexDirection: "column",
            filter: "var(--shadow-float-filter)",
            transform,
            transition,
            touchAction: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              background: "var(--surface)",
              borderRadius: 40,
              border: "1px solid var(--line)",
              padding: "10px 20px 20px",
            }}
          >
            <div
              data-testid="sheet-grabber"
              onPointerDown={(e) => {
                (e.currentTarget as Element).setPointerCapture(e.pointerId);
                startDrag(e.clientY);
              }}
              onPointerMove={(e) => moveDrag(e.clientY)}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{ padding: "8px 0 14px", cursor: "grab", touchAction: "none", flex: "none" }}
            >
              <div style={{ width: 44, height: 5, borderRadius: 999, background: "var(--line)", margin: "0 auto" }} />
            </div>
            <div ref={scrollRef} data-scroll style={{ overflowY: "auto", overscrollBehavior: "contain" }}>
              {children}
            </div>
          </div>
        </div>
        {discardPrompt}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      onClick={requestDismiss}
      onInput={noteTyping}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(26,23,38,.34)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "bqFade .18s ease",
        outline: "none",
      }}
    >
      <div
        onClick={stop}
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
      {discardPrompt}
    </div>,
    document.body,
  );
}

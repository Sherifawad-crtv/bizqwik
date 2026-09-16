import { useEffect, useRef, useState } from "react";
import { playSuccessChime } from "./sound";

// How long the success icon holds before the sheet auto-dismisses — long
// enough to register as a deliberate confirmation, short enough not to feel
// like it's blocking you from moving on.
const SUCCESS_HOLD_MS = 900;

/** Shared "show a big checkmark inside this sheet, then auto-close" behavior
 * for every sheet action that succeeds — confirmations, creates, and edits
 * alike. `open` resets the animation state each time the sheet reopens, so
 * the same component instance is safe to reuse across multiple uses. */
export function useSheetSuccess(open: boolean, onClose: () => void) {
  const [confirmed, setConfirmed] = useState(false);
  const [iconIn, setIconIn] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const frame1 = useRef<number | undefined>(undefined);
  const frame2 = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setConfirmed(false);
      setIconIn(false);
    }
  }, [open]);

  useEffect(
    () => () => {
      window.clearTimeout(closeTimer.current);
      cancelAnimationFrame(frame1.current!);
      cancelAnimationFrame(frame2.current!);
    },
    [],
  );

  const showSuccess = () => {
    setConfirmed(true);
    playSuccessChime();
    // Two rAFs so the "scaled down" starting state actually paints before
    // transitioning — same technique used for the route-push animation.
    frame1.current = requestAnimationFrame(() => {
      frame2.current = requestAnimationFrame(() => setIconIn(true));
    });
    closeTimer.current = window.setTimeout(onClose, SUCCESS_HOLD_MS);
  };

  const cancelPending = () => window.clearTimeout(closeTimer.current);

  return { confirmed, iconIn, showSuccess, cancelPending };
}

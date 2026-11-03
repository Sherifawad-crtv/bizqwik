import { useEffect, useRef, useState } from "react";
import { playSuccessChime } from "./sound";
import { SUCCESS_HOLD_MS } from "./motion";

/** Shared "show a big checkmark inside this sheet, then auto-close" behavior
 * for every sheet action that succeeds — confirmations, creates, and edits
 * alike. `open` resets the animation state each time the sheet reopens, so
 * the same component instance is safe to reuse across multiple uses. */
export function useSheetSuccess(open: boolean, onClose: () => void, opts?: { quiet?: boolean }) {
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
    // A routine edit (renaming a tier, changing a plan) just closes: people
    // expect it to work and see the change in the list. The checkmark and
    // chime are kept for money, records, sends and deletes.
    if (opts?.quiet) {
      onClose();
      return;
    }
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

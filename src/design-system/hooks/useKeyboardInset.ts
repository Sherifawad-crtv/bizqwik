import { useEffect, useState } from "react";

// Approximates the on-screen keyboard's height via the VisualViewport API,
// so a screen can shrink/scroll its content above the keyboard instead of
// letting it hide underneath — the "native app" keyboard-avoidance most
// mobile browsers don't give a plain centered layout for free.
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!active || !vv) {
      setInset(0);
      return;
    }
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);

  return inset;
}

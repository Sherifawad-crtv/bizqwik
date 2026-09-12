import { useEffect, useState } from "react";

const BREAKPOINT = 1024;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < BREAKPOINT,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < BREAKPOINT);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return isMobile;
}

// Below this, the bottom nav's regular sizing doesn't fit a 5-tab roster
// next to the FAB without clipping (measured: needs 404px). At or above it —
// iPhone Pro Max/Plus-class phones and up — there's room to spare, so the
// nav keeps its original, more spacious sizing there.
const NARROW_PHONE_BREAKPOINT = 405;

export function useIsNarrowPhone(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window === "undefined" ? false : window.innerWidth < NARROW_PHONE_BREAKPOINT,
  );

  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < NARROW_PHONE_BREAKPOINT);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return narrow;
}

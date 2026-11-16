import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useScreenActive, useScreenPath } from "./screenActive";

/** The main actions of a sub-page (the screens you open from a tab). On a phone
 * they float at the bottom where the tab bar would be: sub-pages have no tab
 * bar, so their primary buttons take its place. */
interface Published {
  path: string | null;
  node: ReactNode;
}

const ValueCtx = createContext<Published | null>(null);
const SetCtx = createContext<(p: Published | null) => void>(() => {});

export function FloatingActionsProvider({ children }: { children: ReactNode }) {
  const [pub, setPub] = useState<Published | null>(null);
  // The setter context never changes, so a screen publishing its actions doesn't re-render itself.
  const set = useMemo(() => setPub, []);
  return (
    <SetCtx.Provider value={set}>
      <ValueCtx.Provider value={pub}>{children}</ValueCtx.Provider>
    </SetCtx.Provider>
  );
}

/** What the current screen published (null when it has none). */
export function usePublishedActions(): Published | null {
  return useContext(ValueCtx);
}

/** A sub-page calls this with its main buttons (or null for none). Only the
 * screen being looked at publishes; it takes them away when it goes. */
export function useFloatingActions(node: ReactNode) {
  const set = useContext(SetCtx);
  const active = useScreenActive();
  const path = useScreenPath();
  // Every render, so buttons that depend on state (busy, disabled) stay current.
  useLayoutEffect(() => {
    if (active && node) set({ path, node });
    else if (active) set(null);
  });
  useLayoutEffect(() => () => set(null), [set]);
}

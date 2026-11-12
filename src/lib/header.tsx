import { useScreenActive, useScreenPath } from "./screenActive";
import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";

export interface HeaderSpec {
  kicker: string;
  title: string;
  right?: ReactNode;
  /** The route whose screen published this title (set automatically). */
  path?: string | null;
}

interface HeaderCtx {
  header: HeaderSpec;
  setHeader: (h: HeaderSpec) => void;
}

const Ctx = createContext<HeaderCtx | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HeaderSpec>({ kicker: "", title: "" });
  const value = useMemo(() => ({ header, setHeader }), [header]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useHeaderCtx(): HeaderCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useHeader must be used within HeaderProvider");
  return ctx;
}

export function useHeader(): HeaderSpec {
  return useHeaderCtx().header;
}

/** Screens call this to publish their title into the Shell's sticky bar. */
export function useSetHeader(spec: HeaderSpec | null, deps: unknown[]) {
  const { setHeader } = useHeaderCtx();
  // Only the screen you're looking at owns the title: one kept underneath must
  // not overwrite it, and it republishes its own when you come back to it.
  const active = useScreenActive();
  const path = useScreenPath();
  // A layout effect: the title changes in the same frame the screen appears,
  // not a moment later.
  useLayoutEffect(() => {
    if (spec && active) setHeader({ ...spec, path }); // null: shown inside a modal, so the page title stays
    // Deliberate: `spec` is a new object every render; `deps` says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, active]);
}

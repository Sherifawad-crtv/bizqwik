import { useScreenActive } from "./screenActive";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface HeaderSpec {
  kicker: string;
  title: string;
  right?: ReactNode;
}

interface HeaderCtx {
  header: HeaderSpec;
  setHeader: (h: HeaderSpec) => void;
}

const Ctx = createContext<HeaderCtx | null>(null);

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<HeaderSpec>({ kicker: "", title: "" });
  return <Ctx.Provider value={{ header, setHeader }}>{children}</Ctx.Provider>;
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
  useEffect(() => {
    if (spec && active) setHeader(spec); // null: shown inside a modal, so the page title stays
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, active]);
}

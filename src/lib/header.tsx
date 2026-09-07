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
export function useSetHeader(spec: HeaderSpec, deps: unknown[]) {
  const { setHeader } = useHeaderCtx();
  useEffect(() => {
    setHeader(spec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

import { createContext, useContext, useState, type ReactNode } from "react";
import { MOCK } from "./backend";

interface OwnMonthState {
  month: string;
  setMonth: (m: string) => void;
}

const Ctx = createContext<OwnMonthState | null>(null);

/** Tracks which month the signed-in user is currently viewing of their own
 * wallet — the global Add-Session FAB always targets this month. */
export function OwnMonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState(MOCK.CURRENT_MONTH);
  return <Ctx.Provider value={{ month, setMonth }}>{children}</Ctx.Provider>;
}

export function useOwnMonth(): OwnMonthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOwnMonth must be used within OwnMonthProvider");
  return ctx;
}

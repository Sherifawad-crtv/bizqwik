import type { State } from "../types";
import { STATE_LABELS } from "../types";
import { StatusBadge, type Tone } from "../../design-system/components/Tag";

const TONE: Record<State, Tone> = { logging: "logging", settled: "settled", paid: "paid" };

/** A coach month's state (LOGGING / SETTLED / PAID). */
export function StatePill({ state, label }: { state: State; label?: string }) {
  return <StatusBadge tone={TONE[state]}>{(label ?? STATE_LABELS[state]).toUpperCase()}</StatusBadge>;
}

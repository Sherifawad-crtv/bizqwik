import type { State } from "../lib/types";
import { STATE_LABELS } from "../lib/types";
import { StatusBadge, type Tone } from "./Tag";

const TONE: Record<State, Tone> = { logging: "logging", settled: "settled", paid: "paid" };

/** A coach month's state (LOGGING / SETTLED / PAID). */
export function StatePill({ state, label }: { state: State; label?: string }) {
  return <StatusBadge tone={TONE[state]}>{(label ?? STATE_LABELS[state]).toUpperCase()}</StatusBadge>;
}

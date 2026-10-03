import { Icon } from "./Icon";
import { useAuth } from "../lib/auth";
import { isSoloOwner } from "../lib/nav";
import type { PayMethod } from "../lib/types";

const OPTIONS: { value: PayMethod; label: string; icon: "cash" | "card" | "wallet"; note: string }[] = [
  { value: "cash", label: "Cash", icon: "cash", note: "Paid in cash" },
  { value: "card", label: "Card", icon: "card", note: "Paid by card" },
  { value: "instapay", label: "InstaPay", icon: "wallet", note: "Bank transfer" },
];

/** Cash, card or InstaPay as big cards, for a sale where the client has no wallet yet. */
export function PaymentCards({ value, onChange }: { value: PayMethod; onChange: (v: PayMethod) => void }) {
  const { profile, orgMode } = useAuth();
  // A solo business has no card machine: cash or InstaPay only.
  const options = profile && isSoloOwner(profile.role, orgMode) ? OPTIONS.filter((o) => o.value !== "card") : OPTIONS;
  return (
    <div role="radiogroup" aria-label="Payment" style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, 1fr)`, gap: 8 }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-sq
            onClick={() => onChange(o.value)}
            style={{
              minHeight: 130,
              padding: 14,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: "var(--r-card)",
              border: on ? "2px solid var(--primary)" : "1px solid var(--line)",
              background: on ? "var(--primary-tint)" : "var(--surface)",
              color: on ? "var(--primary-pressed)" : "var(--ink)",
            }}
          >
            <Icon name={o.icon} size={40} solid={on} />
            <span>
              <span style={{ display: "block", font: "800 17px var(--font-body)", letterSpacing: "-.01em" }}>{o.label}</span>
              <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>{o.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

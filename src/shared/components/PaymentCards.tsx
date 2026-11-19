import { Icon } from "../../design-system/components/Icon";
import { useAuth } from "../auth";
import { isSoloOwner } from "../screen/nav";
import type { PayMethod } from "../types";
import "./PaymentCards.css";

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
    <div className="bq-grid bq-gap-2" role="radiogroup" aria-label="Payment" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            style={{
              minHeight: 130,
              padding: 14,
              cursor: "pointer",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: "var(--radius-card)",
              border: on ? "2px solid var(--color-bg-fill-primary-default)" : "1px solid var(--color-border-primary-default)",
              background: on ? "var(--color-bg-fill-accent-default)" : "var(--color-bg-surface-primary-default)",
              color: on ? "var(--color-bg-fill-primary-active)" : "var(--color-text-primary-default)",
            }}
          >
            <Icon name={o.icon} size={40} solid={on} />
            <span>
              <span className="bq-payment-cards-title">{o.label}</span>
              <span className="bq-payment-cards-meta">{o.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

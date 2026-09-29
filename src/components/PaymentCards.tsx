import { Icon } from "./Icon";
import type { PayMethod } from "../lib/types";

const OPTIONS: { value: PayMethod; label: string; icon: "cash" | "card"; note: string }[] = [
  { value: "cash", label: "Cash", icon: "cash", note: "Paid in cash" },
  { value: "card", label: "Card", icon: "card", note: "Paid by card" },
];

/** Cash or card as two big cards, for a sale where the client has no wallet yet. */
export function PaymentCards({ value, onChange }: { value: PayMethod; onChange: (v: PayMethod) => void }) {
  return (
    <div role="radiogroup" aria-label="Payment" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {OPTIONS.map((o) => {
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
              minHeight: 150,
              padding: 18,
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
              <span style={{ display: "block", font: "800 20px var(--font-body)", letterSpacing: "-.01em" }}>{o.label}</span>
              <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>{o.note}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

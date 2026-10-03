import { Segmented } from "./Segmented";
import { useAuth } from "../lib/auth";
import { isSoloOwner } from "../lib/nav";
import type { PayMethod } from "../lib/types";

/** Cash / card / InstaPay / wallet picker for a desk sale. `wallet` is only offered when a
 * paying member is in context (a brand-new client has no balance yet); when it's
 * hidden and the current value was "wallet", the caller should fall back to cash. */
export function PaymentSelect({
  value,
  onChange,
  wallet = false,
}: {
  value: PayMethod;
  onChange: (v: PayMethod) => void;
  wallet?: boolean;
}) {
  const { profile, orgMode } = useAuth();
  // A solo business has no card machine and no member wallets: cash or InstaPay only.
  const solo = !!profile && isSoloOwner(profile.role, orgMode);
  const options = solo
    ? [
        { value: "cash" as const, label: "CASH" },
        { value: "instapay" as const, label: "INSTAPAY" },
      ]
    : [
        { value: "cash" as const, label: "CASH" },
        { value: "card" as const, label: "CARD" },
        { value: "instapay" as const, label: "INSTAPAY" },
        ...(wallet ? [{ value: "wallet" as const, label: "WALLET" }] : []),
      ];
  return (
    <div>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "0 2px 6px" }}>PAYMENT</div>
      <Segmented value={value} options={options} onChange={(v) => onChange(v as PayMethod)} />
    </div>
  );
}

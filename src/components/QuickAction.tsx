import { Icon, type IconName } from "./Icon";

/** A round, solid-colour action with its label underneath — the same shape as
 * the member app's quick actions, so it reads as something to tap. */
export function QuickAction({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button className="bq-qa" onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: 0, background: "none", cursor: "pointer", padding: 0 }}>
      <span style={{ width: 56, height: 56, borderRadius: 999, background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 20px rgba(90,65,255,.28)" }}>
        <Icon name={icon} size={24} />
      </span>
      <span style={{ font: "600 13px/1.2 var(--font-body)", color: "var(--ink)", textAlign: "center" }}>{label}</span>
    </button>
  );
}

import { Icon } from "../../design-system/components/Icon";

export function FabButton({ size, label, onClick, opacity = 1 }: { size: number; label: string; onClick: () => void; opacity?: number }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="bq-scale"
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: 999,
        border: 0,
        background: "var(--color-bg-fill-primary-default)",
        color: "var(--color-bg-surface-primary-default)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "var(--shadow-fab)",
        opacity,
      }}
    >
      <Icon name="plus" size={28} strokeWidth={2.4} />
    </button>
  );
}

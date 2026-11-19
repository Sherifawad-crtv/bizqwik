import { Icon } from "../../design-system/components/Icon";
import "./FabButton.css";

export function FabButton({ size, label, onClick, opacity = 1 }: { size: number; label: string; onClick: () => void; opacity?: number }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="bq-scale bq-fab-button-btn"
      style={{ width: size, height: size, opacity }}
    >
      <Icon name="plus" size={28} strokeWidth={2.4} />
    </button>
  );
}

import { Icon } from "./Icon";

interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
}

export function Stepper({ value, min = 1, max = 12, onChange }: StepperProps) {
  return (
    <div className="bq-stepper-box">
      <div className="bq-label">SESSIONS THAT DAY</div>
      <div className="bq-flex bq-items-center bq-gap-4 bq-mt-2">
        <button className="bq-stepper-btn"
          type="button"
          aria-label="Fewer"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{ cursor: value <= min ? "default" : "pointer", opacity: value <= min ? 0.4 : 1 }}
        >
          <Icon name="minus" size={18} strokeWidth={2.4} />
        </button>
        <span className="tabular bq-stepper-title">
          {value}
        </span>
        <button className="bq-stepper-btn-2"
          type="button"
          aria-label="More"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{ cursor: value >= max ? "default" : "pointer", opacity: value >= max ? 0.4 : 1 }}
        >
          <Icon name="plus" size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

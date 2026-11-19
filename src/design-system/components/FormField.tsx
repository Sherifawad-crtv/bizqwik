import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

export function TextField({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="bq-form-field-text-field-label">
      <span className="bq-label">{label}</span>
      <input className="bq-form-field-text-field-input"
        {...rest}
      />
    </label>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** What to show when there's nothing to pick yet — why, and what to do. */
  empty?: { title: string; body?: ReactNode };
}

/** Custom sheet-based picker, not a native <select> — a native picker inside an
 * installed iOS PWA kicks Safari out of standalone mode for the rest of the session. */
export function SelectField({ label, value, options, onChange, placeholder, disabled, empty }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button className="bq-form-field-select-field-btn"
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{ cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.6 : 1 }}
      >
        <span className="bq-label">{label}</span>
        <div className="bq-flex bq-items-center bq-gap-2">
          <span className="bq-form-field-select-field-text" style={{ color: selected ? "var(--color-text-primary-default)" : "var(--color-text-tertiary-default)" }}>
            {selected?.label ?? (options.length === 0 ? (empty?.title ?? "Nothing to choose yet") : (placeholder ?? "Select…"))}
          </span>
          <span className="bq-ml-auto bq-fg-tertiary bq-flex">
            <Icon name="chevron-down" size={15} />
          </span>
        </div>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div className="bq-label">{label}</div>
        {options.length === 0 ? (
          <>
            <EmptyState bare icon="inbox" title={empty?.title ?? "Nothing to choose yet"} body={empty?.body ?? "There are no options here yet."} />
            <Button className="bq-mt-2" variant="secondary" fullWidth onClick={() => setOpen(false)}>
              OK
            </Button>
          </>
        ) : (
          <div className="bq-title">Choose one</div>
        )}
        <div className="bq-flex bq-col bq-gap-2">
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button className="bq-form-field-select-field-btn-2"
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={{ background: on ? "var(--color-bg-fill-accent-default)" : "var(--color-bg-surface-secondary-default)", color: on ? "var(--color-bg-fill-primary-active)" : "var(--color-text-primary-default)" }}
              >
                {o.label}
                {on && (
                  <span className="bq-ml-auto bq-flex">
                    <Icon name="check" size={16} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

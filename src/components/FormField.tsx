import { useState, type InputHTMLAttributes } from "react";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";

export function TextField({ label, ...rest }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label data-sq style={{ display: "block", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px" }}>
      <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</span>
      <input
        {...rest}
        style={{ display: "block", width: "100%", border: 0, background: "none", outline: "none", font: "600 16px var(--font-body)", color: "var(--ink)", padding: "2px 0 0" }}
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
}

/** Custom sheet-based picker, not a native <select> — a native picker inside an
 * installed iOS PWA kicks Safari out of standalone mode for the rest of the session. */
export function SelectField({ label, value, options, onChange, placeholder, disabled }: SelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      <button
        type="button"
        data-sq
        onClick={() => setOpen(true)}
        disabled={disabled}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          background: "var(--sunken)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-input)",
          padding: "10px 16px",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "600 16px var(--font-body)", color: selected ? "var(--ink)" : "var(--ink-faint)" }}>
            {selected?.label ?? placeholder ?? "Select…"}
          </span>
          <span style={{ marginLeft: "auto", color: "var(--ink-faint)", display: "flex" }}>
            <Icon name="chevron-down" size={15} />
          </span>
        </div>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</div>
        <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Choose one</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                data-sq
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  textAlign: "left",
                  background: on ? "var(--primary-tint)" : "var(--sunken)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--r-input)",
                  padding: "14px 16px",
                  cursor: "pointer",
                  font: "700 16px var(--font-body)",
                  color: on ? "var(--primary-pressed)" : "var(--ink)",
                }}
              >
                {o.label}
                {on && (
                  <span style={{ marginLeft: "auto", display: "flex" }}>
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

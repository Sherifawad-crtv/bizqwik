import { useRef } from "react";
import { dateLabel } from "../lib/format";

interface DateFieldProps {
  value: string; // ISO yyyy-mm-dd
  min?: string;
  max?: string;
  onChange: (iso: string) => void;
}

export function DateField({ value, min, max, onChange }: DateFieldProps) {
  const ref = useRef<HTMLInputElement>(null);

  const open = () => {
    const el = ref.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.focus();
  };

  return (
    <div
      data-sq
      onClick={open}
      style={{
        position: "relative",
        width: "100%",
        textAlign: "left",
        background: "var(--sunken)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-input)",
        padding: "12px 16px",
        cursor: "pointer",
      }}
    >
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>DATE</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ font: "600 16px var(--font-body)", color: "var(--ink)" }}>{dateLabel(value)}</span>
        <span style={{ marginLeft: "auto", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>TAP TO CHANGE</span>
      </div>
      <input
        ref={ref}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
        }}
      />
    </div>
  );
}

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

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

export function SelectField({
  label,
  children,
  ...rest
}: { label: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label data-sq style={{ display: "block", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px" }}>
      <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</span>
      <select
        {...rest}
        style={{ display: "block", width: "100%", border: 0, background: "none", outline: "none", font: "600 16px var(--font-body)", color: "var(--ink)", padding: "2px 0 0" }}
      >
        {children}
      </select>
    </label>
  );
}

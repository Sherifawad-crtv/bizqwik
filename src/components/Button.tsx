import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: "var(--primary)", fg: "var(--surface)" },
  secondary: { bg: "var(--primary-tint)", fg: "var(--primary-pressed)" },
  quiet: { bg: "var(--paper)", fg: "var(--ink-muted)", border: "1px solid var(--line)" },
  danger: { bg: "var(--danger-bg)", fg: "var(--danger-fg)" },
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  size?: "md" | "lg";
}

export function Button({ variant = "primary", fullWidth, size = "md", style, disabled, ...rest }: ButtonProps) {
  const v = VARIANTS[variant];
  const height = size === "lg" ? 56 : 48;
  return (
    <button
      data-sq
      disabled={disabled}
      style={{
        height,
        padding: "0 22px",
        width: fullWidth ? "100%" : undefined,
        borderRadius: "var(--r-button)",
        border: v.border ?? 0,
        background: v.bg,
        color: v.fg,
        font: "700 16px var(--font-body)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "opacity .15s ease, transform .15s ease",
        ...style,
      }}
      {...rest}
    />
  );
}

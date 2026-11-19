import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "quiet" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  size?: "md" | "lg";
}

/** The one button. Look and behaviour (press, hover, disabled) live in
 * `.bq-btn` in index.css; this only picks the modifiers. */
export function Button({ variant = "primary", fullWidth, size = "md", className, ...rest }: ButtonProps) {
  const cls = ["bq-btn", `bq-btn--${variant}`, size === "lg" && "bq-btn--lg", fullWidth && "bq-btn--full", className].filter(Boolean).join(" ");
  return <button className={cls} {...rest} />;
}

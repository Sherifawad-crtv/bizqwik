import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

/** A round button with only an icon (edit, delete, remove). Always give it a
 * `label`: it is what screen readers say and what the hover hint shows.
 * tone: primary (default), danger, neutral, plain. */
export function IconButton({ icon, label, tone = "primary", size = 15, className, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { icon: IconName; label: string; tone?: "primary" | "danger" | "neutral" | "plain"; size?: number }) {
  const cls = ["bq-iconbtn", "bq-hit", tone !== "primary" && `bq-iconbtn--${tone}`, className].filter(Boolean).join(" ");
  return (
    <button type="button" aria-label={label} title={label} className={cls} {...rest}>
      <Icon name={icon} size={size} />
    </button>
  );
}

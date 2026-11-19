/** Join class names, skipping empty ones: cx("bq-card", on && "is-on"). */
export const cx = (...names: (string | false | null | undefined)[]): string => names.filter(Boolean).join(" ");

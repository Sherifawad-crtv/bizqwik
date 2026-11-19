import type { HTMLAttributes } from "react";

/** One row of a list. Put rows inside <Card pad="none" clip>. `divider` draws the
 * line under it (pass false for the last row). density: regular 16×20, compact 12×18. */
export function ListRow({ divider = true, density = "regular", className, ...rest }: HTMLAttributes<HTMLDivElement> & { divider?: boolean; density?: "regular" | "compact" }) {
  return <div className={listRowClass(divider, density, className)} {...rest} />;
}

export function listRowClass(divider = true, density: "regular" | "compact" = "regular", extra?: string) {
  return ["bq-listrow", density === "compact" && "bq-listrow--compact", divider && "bq-listrow--divider", extra].filter(Boolean).join(" ");
}

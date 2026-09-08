import type { Role } from "./types";
import type { IconName } from "../components/Icon";

export interface NavItem {
  key: string;
  path: string;
  label: string;
  icon: IconName;
}

/** Index of the tab item matching a pathname, or -1 if none does. Shared by
 * the bottom nav's sliding pill and the tab content's sliding transition so
 * both always agree on which tab is active. */
export function matchTabIndex(pathname: string, items: NavItem[]): number {
  return items.findIndex((t) => (t.path === "/" ? pathname === "/" : pathname.startsWith(t.path)));
}

export const NAV: Record<Role, NavItem[]> = {
  coach: [{ key: "mine", path: "/", label: "My Month", icon: "mine" }],
  head_coach: [
    { key: "coaches", path: "/coaches", label: "Coaches", icon: "coaches" },
    { key: "mine", path: "/", label: "My Month", icon: "mine" },
  ],
  dept_head: [
    { key: "coaches", path: "/coaches", label: "Coaches", icon: "coaches" },
    { key: "mine", path: "/", label: "My Month", icon: "mine" },
    { key: "oversight", path: "/oversight", label: "Oversight", icon: "oversight" },
    { key: "manage", path: "/manage", label: "Tiers & People", icon: "manage" },
  ],
  accountant: [
    { key: "topay", path: "/pay", label: "To Pay", icon: "topay" },
    { key: "history", path: "/history", label: "History", icon: "history" },
  ],
};

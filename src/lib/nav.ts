import type { Role } from "./types";

export type OrgMode = "solo" | "team";
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

/** Where "/" actually lands a given role — dept_head and accountant are
 * redirected elsewhere by Home.tsx, so their real landing screen is the
 * redirect target, not "/" itself. This is each role's one "home" screen:
 * the only place with no screen-name text and no back button, where the
 * avatar lives blended into the page instead of in any bar. */
export function homePathForRole(role: Role, mode: OrgMode = "team"): string {
  if (role === "dept_head") return mode === "solo" ? "/" : "/oversight";
  if (role === "accountant") return "/pay";
  return "/";
}

/** The account section reached by tapping the home screen's avatar — the
 * only place that gets a back button, one level at a time. */
const ACCOUNT_ROUTES = new Set(["/account", "/account/profile", "/account/password"]);

export type HeaderMode = "home" | "account" | "plain";

/** "home": no top chrome at all (avatar lives in the page itself).
 * "account": centered screen name + a back button (the avatar's own stack).
 * "plain": centered screen name only — every other screen, including ones
 * drilled into from within a tab (e.g. a coach's detail page), which keep
 * their own existing in-body back link untouched. */
export function headerMode(pathname: string, role: Role, mode: OrgMode = "team"): HeaderMode {
  if (ACCOUNT_ROUTES.has(pathname)) return "account";
  if (pathname === homePathForRole(role, mode)) return "home";
  return "plain";
}

/** Where the account stack's back button goes: /account itself returns to
 * the role's home screen; its children return to /account. */
export function accountBackTarget(pathname: string, role: Role, mode: OrgMode = "team"): string {
  if (pathname === "/account") return homePathForRole(role, mode);
  return "/account";
}

// The home-tab entry (icon: "home") is always placed first in each role's
// array, so it renders as the leftmost tab for every role, consistently.
export const NAV: Record<Role, NavItem[]> = {
  coach: [
    { key: "mine", path: "/", label: "My Month", icon: "home" },
    { key: "clients", path: "/clients", label: "Clients", icon: "clients" },
    { key: "history", path: "/history", label: "History", icon: "history" },
  ],
  head_coach: [
    { key: "mine", path: "/", label: "My Month", icon: "home" },
    { key: "coaches", path: "/coaches", label: "Team", icon: "coaches" },
    { key: "clients", path: "/clients", label: "Clients", icon: "clients" },
    { key: "history", path: "/history", label: "History", icon: "history" },
  ],
  // The founder view: money first; clients are read-only (the front desk
  // registers and sells); Team & Tiers lives under Team.
  dept_head: [
    { key: "oversight", path: "/oversight", label: "Overview", icon: "home" },
    { key: "coaches", path: "/coaches", label: "Team", icon: "coaches" },
    { key: "clients", path: "/clients", label: "Clients", icon: "clients" },
    { key: "catalog", path: "/catalog", label: "Catalog", icon: "tag" },
    { key: "history", path: "/history", label: "History", icon: "history" },
  ],
  accountant: [
    { key: "topay", path: "/pay", label: "To Pay", icon: "home" },
    { key: "revenue", path: "/revenue", label: "Revenue", icon: "insights" },
    { key: "transactions", path: "/transactions", label: "Money", icon: "wallet" },
    { key: "history", path: "/history", label: "History", icon: "history" },
  ],
  front_desk: [
    { key: "desk", path: "/", label: "Desk", icon: "home" },
    { key: "bookings", path: "/bookings", label: "Bookings", icon: "calendar" },
    { key: "members", path: "/members", label: "Clients", icon: "clients" },
    { key: "activity", path: "/activity", label: "Activity", icon: "history" },
  ],
};

/** A solo business: the owner does it all, so five tabs and nothing about
 * teams, tiers or payouts. */
export const SOLO_NAV: NavItem[] = [
  { key: "today", path: "/", label: "Today", icon: "home" },
  { key: "clients", path: "/members", label: "Clients", icon: "members" },
  { key: "plans", path: "/catalog", label: "Plans", icon: "tag" },
  { key: "schedule", path: "/bookings", label: "Schedule", icon: "calendar" },
  { key: "money", path: "/money", label: "Money", icon: "wallet" },
];

export const isSoloOwner = (role: Role, mode: OrgMode) => role === "dept_head" && mode === "solo";

/** The tabs for who is signed in. */
export function navFor(role: Role, mode: OrgMode): NavItem[] {
  return isSoloOwner(role, mode) ? SOLO_NAV : NAV[role];
}

import { NavLink } from "react-router-dom";
import { Avatar } from "./Avatar";
import { useIsMobile } from "../lib/useIsMobile";

/** The one place the avatar (and its greeting) lives — mobile only, blended
 * into each role's home screen instead of a persistent header bar, tapping
 * into the account stack. On desktop the sidebar already shows the avatar
 * (and links to /account) and the page has its own heading, so this
 * renders nothing there. `greeting` sits opposite the avatar as a
 * headline. */
export function HomeAvatar({ name, avatarUrl, greeting }: { name: string; avatarUrl: string | null; greeting?: string }) {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: greeting ? "space-between" : "flex-end", gap: 12, marginBottom: 28 }}>
      {greeting && (
        <div style={{ flex: 1, minWidth: 0, font: "800 28px/1.15 var(--font-body)", letterSpacing: "-.02em" }}>{greeting}</div>
      )}
      <NavLink to="/account" aria-label="Account" style={{ flex: "none" }}>
        <Avatar name={name} size={64} src={avatarUrl} />
      </NavLink>
    </div>
  );
}

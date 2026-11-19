import { NavLink } from "react-router-dom";
import { Avatar } from "../../design-system/components/Avatar";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import "./HomeAvatar.css";

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
    <div className="bq-flex bq-items-center bq-gap-3 bq-mb-6" style={{ justifyContent: greeting ? "space-between" : "flex-end" }}>
      {greeting && (
        <div className="bq-home-avatar-title">{greeting}</div>
      )}
      <NavLink className="bq-flex-none" to="/account" aria-label="Account">
        <Avatar name={name} size={64} src={avatarUrl} />
      </NavLink>
    </div>
  );
}

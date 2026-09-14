import { NavLink } from "react-router-dom";
import { Avatar } from "./Avatar";

/** The one place the avatar lives now — blended into each role's home
 * screen instead of a persistent header bar. Taps into the account stack. */
export function HomeAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <NavLink to="/account" aria-label="Account">
        <Avatar name={name} size={40} src={avatarUrl} />
      </NavLink>
    </div>
  );
}

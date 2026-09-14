import { NavLink } from "react-router-dom";
import { Avatar } from "./Avatar";

/** The one place the avatar lives now — blended into each role's home
 * screen instead of a persistent header bar. Taps into the account stack.
 * `greeting`, where given, sits opposite the avatar as a big headline. */
export function HomeAvatar({ name, avatarUrl, greeting }: { name: string; avatarUrl: string | null; greeting?: string }) {
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

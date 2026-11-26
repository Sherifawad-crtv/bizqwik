/** Shared JWT auth for all Edge Functions. Uses `_shared/db` only — never import make-server. */
import { admin } from "./db.ts";

// Who's calling. Prefer getClaims (cached JWKS); fall back to auth.getUser.
export async function requireUser(c: { req: { header: (name: string) => string | undefined } }): Promise<{ id: string } | null> {
  const auth = c.req.header("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  try {
    const { data, error } = await admin().auth.getClaims(token);
    if (!error && data?.claims) {
      const { sub, role } = data.claims as { sub?: string; role?: string };
      return sub && role === "authenticated" ? { id: sub } : null;
    }
  } catch {
    // fall through to the auth server
  }
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id };
}

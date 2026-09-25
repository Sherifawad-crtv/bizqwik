import type { Page, Route } from "@playwright/test";
import type { Role } from "../src/lib/types";

// Structurally-valid (unsigned) JWT so supabase-js accepts the mocked session.
function fakeJwt(sub: string, email: string): string {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return [enc({ alg: "HS256", typ: "JWT" }), enc({ sub, email, role: "authenticated", aud: "authenticated", exp: now + 3600, iat: now }), "sig"].join(".");
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, headers: { "content-type": "application/json", ...CORS }, body: JSON.stringify(body) });
}

export function profile(role: Role) {
  return { id: "prof-zz", email: "zz-fd@zztest.dev", name: "Zed Frontdesk", role, tierId: null, avatarUrl: null };
}

/** An override can be a plain response body, or a handler that sees the
 * request body and returns `{ status, body }` — for refusals like a 409, or
 * to capture what the screen sent. */
export type MockHandler = (reqBody: Record<string, unknown> | null) => { status?: number; body: unknown };

// Intercept GoTrue auth + the edge function so the app runs fully offline.
// `role` picks who /me reports; `overrides` maps an endpoint path suffix to a
// response body (or a MockHandler) for test-specific data.
// `startSignedIn` (default true) short-circuits auth so screen tests can jump
// straight in; pass false to exercise the real login form (/me reports no
// profile until the /token endpoint is hit).
export async function mockBackend(
  page: Page,
  role: Role = "front_desk",
  overrides: Record<string, unknown | MockHandler> = {},
  startSignedIn = true,
) {
  const state = { signedIn: startSignedIn };

  await page.route(/\/auth\/v1\//, (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const url = route.request().url();
    const user = { id: "auth-zz", aud: "authenticated", role: "authenticated", email: "zz-fd@zztest.dev", app_metadata: { provider: "email" }, user_metadata: {}, created_at: "2026-09-24T00:00:00Z" };
    if (url.includes("/token")) {
      state.signedIn = true;
      return json(route, { access_token: fakeJwt("auth-zz", "zz-fd@zztest.dev"), token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "refresh-zz", user });
    }
    if (url.includes("/logout")) return route.fulfill({ status: 204, headers: CORS });
    return json(route, user);
  });

  const defaults: Record<string, unknown> = {
    me: { profile: null, tier: null, bizqwikTeam: null }, // replaced below when signed in
    "bundle-types": { bundleTypes: [] },
    "plan-types": { planTypes: [] },
    "class-series": { series: [] },
    classes: { classes: [] },
    clients: { clients: [] },
    "drop-ins": {},
  };

  await page.route(/\/functions\/v1\/make-server-980e1cbf\//, (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/me")) return json(route, state.signedIn ? { profile: profile(role), tier: null, bizqwikTeam: null } : { profile: null, tier: null, bizqwikTeam: null });
    // longest matching suffix wins so "membership-types" beats "types"
    const keys = [...Object.keys(overrides), ...Object.keys(defaults)].sort((a, b) => b.length - a.length);
    for (const k of keys) {
      if (!path.endsWith(`/${k}`)) continue;
      const o = k in overrides ? overrides[k] : defaults[k];
      if (typeof o === "function") {
        let reqBody: Record<string, unknown> | null = null;
        try {
          reqBody = route.request().postDataJSON();
        } catch {
          reqBody = null;
        }
        const r = (o as MockHandler)(reqBody);
        return json(route, r.body, r.status ?? 200);
      }
      return json(route, o);
    }
    return json(route, {}); // unmapped endpoints: harmless empty object
  });
}

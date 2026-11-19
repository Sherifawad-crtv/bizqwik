import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

export { webpush };

export async function fetchRetryingClockSkew(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401) return res;
  const body = await res.clone().text().catch(() => "");
  if (!body.includes("PGRST303")) return res;
  await new Promise((r) => setTimeout(r, 400));
  return fetch(input, init);
}
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Phase 2: transactional Postgres RPCs for wallet/points (default on).
// Set MONEY_RPC=0 to force legacy JS helpers (emergency / parity only).
export const MONEY_RPC = !["0", "false", "off"].includes((Deno.env.get("MONEY_RPC") ?? "1").toLowerCase());
// One client for the whole worker: it holds no user session, and reusing it
// keeps its connection and the auth signing keys cached between requests.
export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: fetchRetryingClockSkew },
});
export const admin = () => adminClient;

// Work the caller doesn't need to wait for (refreshing a cached total): it
// finishes after the response is sent.
export function background(p: PromiseLike<unknown>) {
  const task = Promise.resolve(p).catch((e) => console.log("background task failed", (e as Error)?.message));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(task);
}

// ---- secrets (Vault, via a service-role-only RPC — there's no tool to set
// Edge Function env vars directly, so VAPID keys and the cron shared secret
// live in Supabase Vault instead and are fetched once per cold start). -----
export const secretCache = new Map<string, string>();
export async function getSecret(name: string): Promise<string> {
  if (secretCache.has(name)) return secretCache.get(name)!;
  const { data, error } = await admin().rpc("get_secret", { secret_name: name });
  if (error || !data) throw new Error(`Missing secret: ${name}`);
  secretCache.set(name, data as string);
  return data as string;
}

export let vapidReady: Promise<void> | null = null;
export function ensureVapid(): Promise<void> {
  if (!vapidReady) {
    vapidReady = (async () => {
      const [publicKey, privateKey, subject] = await Promise.all([
        getSecret("vapid_public_key"),
        getSecret("vapid_private_key"),
        getSecret("vapid_subject"),
      ]);
      webpush.setVapidDetails(subject, publicKey, privateKey);
    })();
  }
  return vapidReady;
}

// ---- helpers -----------------------------------------------------------
export const P = "/make-server-980e1cbf";

export function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

// ---- Supabase admin client --------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = () =>
  createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// ---- secrets (Vault, via a service-role-only RPC — there's no tool to set
// Edge Function env vars directly, so VAPID keys and the cron shared secret
// live in Supabase Vault instead and are fetched once per cold start). -----
const secretCache = new Map<string, string>();
async function getSecret(name: string): Promise<string> {
  if (secretCache.has(name)) return secretCache.get(name)!;
  const { data, error } = await admin().rpc("get_secret", { secret_name: name });
  if (error || !data) throw new Error(`Missing secret: ${name}`);
  secretCache.set(name, data as string);
  return data as string;
}

let vapidReady: Promise<void> | null = null;
function ensureVapid(): Promise<void> {
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

// The whole app is single-org today (Revolt) — there's no platform-admin UI
// yet to pick an org at signup, so this resolves to "the one org that
// exists." Revisit once org selection at signup is a real, built UI.
let cachedOrgId: string | null = null;
async function defaultOrgId(): Promise<string> {
  if (cachedOrgId) return cachedOrgId;
  const { data, error } = await admin().from("organizations").select("id").limit(1).single();
  if (error || !data) throw new Error("No organization configured");
  cachedOrgId = data.id;
  return cachedOrgId;
}

// ---- helpers -----------------------------------------------------------
const P = "/make-server-980e1cbf";

function currentMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const isFutureMonth = (m: string) => m > currentMonth();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function requireUser(c: any) {
  const auth = c.req.header("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function profileOf(userId: string) {
  const { data, error } = await admin().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function tierOf(tierId: string) {
  const { data } = await admin().from("tiers").select("*").eq("id", tierId).maybeSingle();
  return data;
}

const stateOf = (s: any) => (!s ? "logging" : s.paid_at ? "paid" : "settled") as "logging" | "settled" | "paid";

// A package's status is never actively ticked over by a background job (this
// app has none) — expiry is evaluated lazily, right when something reads or
// mutates the package, and the correction is persisted so it sticks.
async function materializePackage(pkg: any): Promise<any> {
  if (pkg.status === "active" && todayIso() > String(pkg.expires_at).slice(0, 10)) {
    const { data: updated, error } = await admin().from("package_instances").update({ status: "expired" }).eq("id", pkg.id).select().single();
    if (error) throw error;
    return updated;
  }
  return pkg;
}

// ---- API response mappers (snake_case DB rows -> camelCase JSON, matching
// src/lib/types.ts exactly so the frontend's contract never changes) -------
function toProfile(row: any) {
  return { id: row.id, email: row.email, name: row.name, role: row.role, tierId: row.tier_id, avatarUrl: row.avatar_url ?? null };
}
function toTier(row: any) {
  return { id: row.id, name: row.name, rate: Number(row.hourly_rate), privateCutPct: Number(row.private_cut_pct) };
}
function toBundleType(row: any) {
  return { id: row.id, name: row.name, price: Number(row.price), sessionsIncluded: row.sessions_included, expiryDays: row.expiry_days };
}
function toClient(row: any, conditions: string | null, currentPackage: any) {
  return { id: row.id, name: row.name, age: row.age, conditions, assignedCoachId: row.assigned_coach_id, currentPackage };
}
function toPackageInstance(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    bundleTypeId: row.bundle_type_id,
    coachId: row.coach_id,
    purchaseDate: String(row.purchased_at).slice(0, 10),
    expiryDate: String(row.expires_at).slice(0, 10),
    sessionsIncluded: row.sessions_included,
    sessionsRemaining: row.sessions_remaining,
    priceAtSale: Number(row.price_at_sale),
    coachCutAtSale: Number(row.coach_cut_at_sale),
    status: row.status,
    createdBy: row.created_by,
  };
}
function toSession(row: any) {
  return { id: row.id, coachId: row.coach_id, month: row.month, date: row.date, createdBy: row.created_by };
}
function toInvite(row: any) {
  return { email: row.email, role: row.role, tierId: row.tier_id, invitedBy: row.invited_by };
}
function toSettlement(row: any) {
  return {
    id: row.id,
    coachId: row.coach_id,
    month: row.month,
    rateSnapshot: Number(row.rate_snapshot),
    countSnapshot: row.count_snapshot,
    groupTotal: Number(row.group_total),
    privateTotal: Number(row.private_total),
    settledBy: row.settled_by,
    settledAt: row.settled_at,
    paidBy: row.paid_by,
    paidAt: row.paid_at,
  };
}

// ---- push notifications --------------------------------------------------
// Every non-accountant role's "home" tab, so a push can deep-link somewhere
// sensible without duplicating the frontend's nav config server-side.
function homePathForRole(role: string): string {
  if (role === "dept_head") return "/oversight";
  if (role === "accountant") return "/pay";
  return "/";
}

/** Sends a push to every device a profile has subscribed from, and always
 * writes one notification_log row for the attempt (sent / failed / the
 * profile had no registered subscriptions at all). Self-cleans subscriptions
 * the push service reports as gone (404/410) instead of leaving dead
 * endpoints around to keep failing forever. Never throws — a push failure
 * must never break the action that triggered it. */
async function sendPushToProfile(
  orgId: string,
  profileId: string,
  triggerType: string,
  payload: { title: string; body: string; url?: string },
) {
  const results: { endpoint: string; ok: boolean; statusCode?: number; message?: string }[] = [];
  let logStatus: "sent" | "failed" | "no_subscription" = "no_subscription";
  try {
    await ensureVapid();
    const { data: subs, error } = await admin().from("push_subscriptions").select("*").eq("profile_id", profileId);
    if (error) throw error;
    if (subs && subs.length > 0) {
      await Promise.all(
        subs.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify(payload),
              { TTL: 86400 },
            );
            results.push({ endpoint: sub.endpoint, ok: true });
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              await admin().from("push_subscriptions").delete().eq("id", sub.id);
            } else {
              console.log("push send failed", profileId, err?.statusCode, err?.message);
            }
            results.push({ endpoint: sub.endpoint, ok: false, statusCode: err?.statusCode, message: err?.message });
          }
        }),
      );
      logStatus = results.some((r) => r.ok) ? "sent" : "failed";
    }
  } catch (err) {
    console.log("sendPushToProfile error", profileId, (err as Error).message);
    results.push({ endpoint: "n/a", ok: false, message: (err as Error).message });
    logStatus = "failed";
  }
  try {
    await admin().from("notification_log").insert({
      org_id: orgId,
      profile_id: profileId,
      trigger_type: triggerType,
      payload,
      status: logStatus,
    });
  } catch (logErr) {
    console.log("notification_log insert failed", profileId, (logErr as Error).message);
  }
  return results;
}

const app = new Hono();
app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey", "x-client-info", "x-cron-secret"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get(`${P}/health`, (c) => c.json({ status: "ok" }));

// ---- signup (anon) -----------------------------------------------------
// Locked to invited emails only: the very first-ever account bootstraps as
// Department Head (there's no one to have invited them yet); every account
// after that MUST have a matching pending invite, or signup is rejected
// before any auth user is even created. "First-ever" is scoped per org.
app.post(`${P}/signup`, async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: "Email and password required" }, 400);
    const normalizedEmail = String(email).toLowerCase();
    const orgId = await defaultOrgId();

    const { data: existing, error: exErr } = await admin().from("profiles").select("id").eq("org_id", orgId);
    if (exErr) throw exErr;
    const isFirstEver = (existing?.length ?? 0) === 0;

    let invite: any = null;
    if (!isFirstEver) {
      const { data: inv } = await admin().from("staff_invitations").select("*").eq("org_id", orgId).eq("email", normalizedEmail).maybeSingle();
      invite = inv;
      if (!invite) return c.json({ error: "You're not part of this organization." }, 403);
    }

    const { data: created, error: cErr } = await admin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (cErr || !created?.user) return c.json({ error: cErr?.message || "Sign up failed" }, 400);
    const uid = created.user.id;

    let role = "coach";
    let tierId: string | null = null;

    if (isFirstEver) {
      role = "dept_head";
      const { data: tiers } = await admin().from("tiers").select("id").eq("org_id", orgId);
      if (!tiers || tiers.length === 0) {
        await admin().from("tiers").insert([
          { org_id: orgId, name: "Tier 1", hourly_rate: 150, private_cut_pct: 50 },
          { org_id: orgId, name: "Tier 2", hourly_rate: 250, private_cut_pct: 50 },
        ]);
      }
    } else {
      role = invite.role;
      tierId = invite.tier_id;
      await admin().from("staff_invitations").delete().eq("id", invite.id);
    }

    const { data: profile, error: pErr } = await admin()
      .from("profiles")
      .insert({ id: uid, org_id: orgId, role, name: email, email, tier_id: tierId, avatar_url: null })
      .select()
      .single();
    if (pErr) throw pErr;

    return c.json({ profile: toProfile(profile) });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ---- me ----------------------------------------------------------------
app.get(`${P}/me`, async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const profile = await profileOf(user.id);
  if (!profile) return c.json({ error: "No profile" }, 404);
  const tier = profile.tier_id ? await tierOf(profile.tier_id) : null;
  return c.json({ profile: toProfile(profile), tier: tier ? toTier(tier) : null });
});

// Self-service: change your own display name and/or avatar photo.
// Email/role/tier are deliberately NOT editable here — those stay
// dept_head-only, managed through /profiles/assign-tier and the
// invite/remove flows. The actual image file is uploaded straight to
// Supabase Storage from the client (its own bucket policies enforce that a
// user can only write under their own uid) — this endpoint only ever
// receives the resulting public URL string, never file bytes.
app.post(`${P}/me/update`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) return c.json({ error: "Name is required." }, 400);
    updates.name = String(body.name).trim();
  }
  if (body.avatarUrl !== undefined) updates.avatar_url = body.avatarUrl;
  const { data: updated, error } = await admin().from("profiles").update(updates).eq("id", me.id).select().single();
  if (error) throw error;
  return c.json({ profile: toProfile(updated) });
});

// ---- push notifications --------------------------------------------------
// Public: the frontend needs the VAPID public key to call
// pushManager.subscribe(). It's not secret — only the private key is.
app.get(`${P}/push/vapid-public-key`, async (c) => {
  const publicKey = await getSecret("vapid_public_key");
  return c.json({ publicKey });
});

app.post(`${P}/push/subscribe`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { endpoint, keys, deviceId } = await c.req.json();
  if (!endpoint || !keys?.p256dh || !keys?.auth) return c.json({ error: "Invalid subscription." }, 400);
  if (!deviceId) return c.json({ error: "Missing device id." }, 400);
  const { error } = await admin()
    .from("push_subscriptions")
    .upsert({
      id: deviceId,
      org_id: me.org_id,
      profile_id: me.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
  return c.json({ ok: true });
});

app.post(`${P}/push/unsubscribe`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { endpoint, deviceId } = await c.req.json();
  if (!endpoint) return c.json({ error: "Invalid subscription." }, 400);
  if (deviceId) {
    await admin().from("push_subscriptions").delete().eq("id", deviceId).eq("profile_id", me.id);
  } else {
    await admin().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("profile_id", me.id);
  }
  return c.json({ ok: true });
});

// Admin-only diagnostic: sends a real push to a specific profile's
// subscriptions right now, gated by the cron shared secret instead of a
// user JWT so it can be checked directly (e.g. from SQL/pg_net) without
// needing that person's password. Kept for backend debugging — there's no
// UI hook for this, deliberately.
app.post(`${P}/push/test-admin`, async (c) => {
  const provided = c.req.header("x-cron-secret") || "";
  const expected = await getSecret("cron_secret");
  if (provided !== expected) return c.json({ error: "Forbidden" }, 403);
  const { profileId } = await c.req.json();
  const profile = await profileOf(profileId);
  if (!profile) return c.json({ error: "No such profile" }, 404);
  const results = await sendPushToProfile(profile.org_id, profileId, "admin_diagnostic", {
    title: "⚙️ System Test",
    body: "Just a quick test notification sent from the backend. Everything is working fine!",
    url: homePathForRole(profile.role),
  });
  return c.json({ results });
});

// Fired by a pg_cron job (Sun–Thu, 9:00 PM Cairo time) via pg_net — never by
// a user, so it's gated by a shared secret instead of a user JWT. Reminds
// everyone who can log a session (coach, head_coach, dept_head) and hasn't
// logged one yet today, per organization. Accountant is deliberately
// excluded — the app gives that role no way to log a session at all, so the
// reminder would just be noise for them.
app.post(`${P}/push/daily-reminder`, async (c) => {
  const provided = c.req.header("x-cron-secret") || "";
  const expected = await getSecret("cron_secret");
  if (provided !== expected) return c.json({ error: "Forbidden" }, 403);

  const today = todayIso();
  const month = currentMonth();

  const { data: orgs } = await admin().from("organizations").select("id");
  let totalNotified = 0;
  for (const org of orgs ?? []) {
    const [{ data: profiles }, { data: sessions }] = await Promise.all([
      admin().from("profiles").select("*").eq("org_id", org.id).neq("role", "accountant"),
      admin().from("sessions").select("coach_id, date").eq("org_id", org.id).eq("month", month),
    ]);
    const loggedToday = new Set((sessions ?? []).filter((s) => s.date === today).map((s) => s.coach_id));
    const targets = (profiles ?? []).filter((p) => !loggedToday.has(p.id));

    await Promise.all(
      targets.map((p) =>
        sendPushToProfile(org.id, p.id, "daily_reminder", {
          title: "📝 Quick reminder",
          body: "Don't forget to log your sessions today before wrapping up your day!",
          url: homePathForRole(p.role),
        }),
      ),
    );
    totalNotified += targets.length;
  }
  return c.json({ notified: totalNotified });
});

// ---- tiers -------------------------------------------------------------
app.get(`${P}/tiers`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { data, error } = await admin().from("tiers").select("*").eq("org_id", me.org_id).order("name");
  if (error) throw error;
  return c.json({ tiers: (data ?? []).map(toTier) });
});

app.post(`${P}/tiers`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { name, rate, privateCutPct } = await c.req.json();
  const { data, error } = await admin()
    .from("tiers")
    .insert({ org_id: me.org_id, name, hourly_rate: Number(rate), private_cut_pct: Number(privateCutPct) || 0 })
    .select()
    .single();
  if (error) throw error;
  return c.json({ tier: toTier(data) });
});

app.post(`${P}/tiers/update`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id, name, rate, privateCutPct } = await c.req.json();
  const { data, error } = await admin()
    .from("tiers")
    .update({ name, hourly_rate: Number(rate), private_cut_pct: Number(privateCutPct) || 0 })
    .eq("id", id)
    .eq("org_id", me.org_id)
    .select()
    .single();
  if (error) throw error;
  return c.json({ tier: toTier(data) });
});

app.post(`${P}/tiers/delete`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  await admin().from("tiers").delete().eq("id", id).eq("org_id", me.org_id);
  return c.json({ ok: true });
});

// ---- bundle types --------------------------------------------------------
app.get(`${P}/bundle-types`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { data, error } = await admin().from("bundle_types").select("*").eq("org_id", me.org_id).order("name");
  if (error) throw error;
  return c.json({ bundleTypes: (data ?? []).map(toBundleType) });
});

app.post(`${P}/bundle-types`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { name, price, sessionsIncluded, expiryDays } = await c.req.json();
  const { data, error } = await admin()
    .from("bundle_types")
    .insert({ org_id: me.org_id, name, price: Number(price), sessions_included: Number(sessionsIncluded), expiry_days: Number(expiryDays) })
    .select()
    .single();
  if (error) throw error;
  return c.json({ bundleType: toBundleType(data) });
});

app.post(`${P}/bundle-types/update`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id, name, price, sessionsIncluded, expiryDays } = await c.req.json();
  const { data, error } = await admin()
    .from("bundle_types")
    .update({ name, price: Number(price), sessions_included: Number(sessionsIncluded), expiry_days: Number(expiryDays) })
    .eq("id", id)
    .eq("org_id", me.org_id)
    .select()
    .single();
  if (error) throw error;
  return c.json({ bundleType: toBundleType(data) });
});

app.post(`${P}/bundle-types/delete`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  await admin().from("bundle_types").delete().eq("id", id).eq("org_id", me.org_id);
  return c.json({ ok: true });
});

// ---- invites -------------------------------------------------------------
app.get(`${P}/invites`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { data, error } = await admin().from("staff_invitations").select("*").eq("org_id", me.org_id);
  if (error) throw error;
  return c.json({ invites: (data ?? []).map(toInvite) });
});

app.post(`${P}/invites`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { email, role, tierId } = await c.req.json();
  const normalizedEmail = String(email).toLowerCase();
  const { data, error } = await admin()
    .from("staff_invitations")
    .upsert(
      { org_id: me.org_id, email: normalizedEmail, role, tier_id: tierId ?? null, invited_by: me.id },
      { onConflict: "org_id,email" },
    )
    .select()
    .single();
  if (error) throw error;
  return c.json({ invite: toInvite(data) });
});

app.post(`${P}/invites/delete`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { email } = await c.req.json();
  await admin().from("staff_invitations").delete().eq("org_id", me.org_id).eq("email", String(email).toLowerCase());
  return c.json({ ok: true });
});

// ---- profiles ----------------------------------------------------------
app.get(`${P}/profiles`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { data, error } = await admin().from("profiles").select("*").eq("org_id", me.org_id).order("name");
  if (error) throw error;
  return c.json({ profiles: (data ?? []).map(toProfile) });
});

app.post(`${P}/profiles/assign-tier`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id, tierId } = await c.req.json();
  const { data, error } = await admin()
    .from("profiles")
    .update({ tier_id: tierId ?? null })
    .eq("id", id)
    .eq("org_id", me.org_id)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: "No such profile" }, 404);
  return c.json({ profile: toProfile(data) });
});

app.post(`${P}/profiles/remove`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  if (id === me.id) return c.json({ error: "You can't remove your own account" }, 400);
  const profile = await profileOf(id);
  if (!profile || profile.org_id !== me.org_id) return c.json({ error: "No such profile" }, 404);

  await admin().from("sessions").delete().eq("coach_id", id).eq("org_id", me.org_id);
  await admin().from("settlements").delete().eq("coach_id", id).eq("org_id", me.org_id);
  await admin().from("push_subscriptions").delete().eq("profile_id", id);
  await admin().from("profiles").delete().eq("id", id);
  try {
    await admin().auth.admin.deleteUser(id);
  } catch (_) {
    // auth user may already be gone; profile removal is what matters
  }
  return c.json({ ok: true });
});

// ---- clients (private training) -----------------------------------------
async function conditionsOf(clientId: string): Promise<string | null> {
  const { data } = await admin().from("client_notes").select("conditions").eq("client_id", clientId).maybeSingle();
  return data?.conditions ?? null;
}

async function currentPackageForClient(clientId: string, orgId: string) {
  const { data, error } = await admin()
    .from("package_instances")
    .select("*")
    .eq("client_id", clientId)
    .eq("org_id", orgId)
    .order("purchased_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return await materializePackage(data);
}

app.get(`${P}/clients`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  if (me.role === "accountant") return c.json({ error: "Forbidden" }, 403);

  // Only dept_head sees the full roster now — head_coach's private-training
  // access is limited to their own assigned clients (deliver-only, no
  // assign/reassign), same scoping as a plain coach.
  let query = admin().from("clients").select("*").eq("org_id", me.org_id);
  if (me.role !== "dept_head") query = query.eq("assigned_coach_id", me.id);
  const { data: clients, error } = await query.order("name");
  if (error) throw error;

  const rows = await Promise.all(
    (clients ?? []).map(async (cl) => {
      const [pkg, conditions] = await Promise.all([currentPackageForClient(cl.id, me.org_id), conditionsOf(cl.id)]);
      return toClient(cl, conditions, pkg ? toPackageInstance(pkg) : null);
    }),
  );
  return c.json({ clients: rows });
});

// A client and its first package are created together, atomically — a
// client can never exist without an assigned coach (no more "orphaned"
// clients waiting to be picked up later). If the package leg fails after
// the client row is written, the client row is rolled back rather than
// left behind as a half-created record.
async function sellPackageTo(clientId: string, bundleTypeId: string, coachId: string, me: any) {
  const { data: client, error: cErr } = await admin().from("clients").select("*").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
  if (cErr) throw cErr;
  if (!client) return { error: "No such client", status: 404 } as const;

  const current = await currentPackageForClient(clientId, me.org_id);
  if (current && current.status === "active") {
    return { error: "This client already has an active package.", status: 400 } as const;
  }

  const { data: bundleType } = await admin().from("bundle_types").select("*").eq("id", bundleTypeId).eq("org_id", me.org_id).maybeSingle();
  if (!bundleType) return { error: "No such bundle type", status: 404 } as const;
  const coach = await profileOf(coachId);
  if (!coach || coach.org_id !== me.org_id) return { error: "No such coach", status: 404 } as const;
  const tier = coach.tier_id ? await tierOf(coach.tier_id) : null;
  const privateCutPct = tier ? Number(tier.private_cut_pct) : 0;

  const purchaseDate = todayIso();
  const expiryDate = addDays(purchaseDate, Number(bundleType.expiry_days));
  const priceAtSale = Number(bundleType.price);
  const coachCutAtSale = (priceAtSale * privateCutPct) / 100;

  const { data: pkg, error: pErr } = await admin()
    .from("package_instances")
    .insert({
      org_id: me.org_id,
      client_id: clientId,
      bundle_type_id: bundleTypeId,
      coach_id: coachId,
      price_at_sale: priceAtSale,
      coach_cut_at_sale: coachCutAtSale,
      sessions_included: Number(bundleType.sessions_included),
      sessions_remaining: Number(bundleType.sessions_included),
      purchased_at: `${purchaseDate}T00:00:00Z`,
      expires_at: `${expiryDate}T00:00:00Z`,
      status: "active",
      created_by: me.id,
    })
    .select()
    .single();
  if (pErr) throw pErr;

  const wasAssignedBefore = client.assigned_coach_id === coachId;
  await admin().from("clients").update({ assigned_coach_id: coachId }).eq("id", clientId);

  await sendPushToProfile(me.org_id, coachId, wasAssignedBefore ? "package_renewed" : "new_client_assigned", {
    title: wasAssignedBefore ? "🚀 Package renewed!" : "🎉 New client assigned!",
    body: wasAssignedBefore
      ? `Good news! ${client.name} just renewed their ${bundleType.name} package with you.`
      : `${client.name} was just assigned to you for the ${bundleType.name} package. Welcome them aboard!`,
    url: "/clients",
  });

  return { client: { ...client, assigned_coach_id: coachId }, package: pkg } as const;
}

app.post(`${P}/clients`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { name, age, conditions, bundleTypeId, coachId } = await c.req.json();
  if (!name || !bundleTypeId || !coachId) {
    return c.json({ error: "Name, bundle, and coach are all required to create a client." }, 400);
  }

  const { data: client, error: cErr } = await admin()
    .from("clients")
    .insert({
      org_id: me.org_id,
      name,
      age: age === null || age === undefined || age === "" ? null : Number(age),
      assigned_coach_id: null,
    })
    .select()
    .single();
  if (cErr) throw cErr;

  if (conditions) {
    await admin().from("client_notes").insert({ client_id: client.id, org_id: me.org_id, conditions });
  }

  const result = await sellPackageTo(client.id, bundleTypeId, coachId, me);
  if ("error" in result) {
    await admin().from("client_notes").delete().eq("client_id", client.id);
    await admin().from("clients").delete().eq("id", client.id);
    return c.json({ error: result.error }, result.status);
  }
  return c.json({ client: toClient(result.client, conditions || null, null), package: toPackageInstance(result.package) });
});

app.post(`${P}/clients/update`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id, name, age, conditions } = await c.req.json();
  const { data: client, error } = await admin().from("clients").select("*").eq("id", id).eq("org_id", me.org_id).maybeSingle();
  if (error) throw error;
  if (!client) return c.json({ error: "No such client" }, 404);
  if (!name) return c.json({ error: "Name is required." }, 400);

  const { data: updated, error: uErr } = await admin()
    .from("clients")
    .update({ name, age: age === null || age === undefined || age === "" ? null : Number(age) })
    .eq("id", id)
    .select()
    .single();
  if (uErr) throw uErr;

  if (conditions) {
    await admin().from("client_notes").upsert({ client_id: id, org_id: me.org_id, conditions, updated_at: new Date().toISOString() });
  } else {
    await admin().from("client_notes").delete().eq("client_id", id);
  }

  return c.json({ client: toClient(updated, conditions || null, null) });
});

app.post(`${P}/clients/delete`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  const { data: client } = await admin().from("clients").select("id").eq("id", id).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "No such client" }, 404);

  const { data: packages } = await admin().from("package_instances").select("id").eq("client_id", id);
  for (const pkg of packages ?? []) {
    await admin().from("delivery_logs").delete().eq("package_instance_id", pkg.id);
  }
  await admin().from("package_instances").delete().eq("client_id", id);
  await admin().from("client_notes").delete().eq("client_id", id);
  await admin().from("clients").delete().eq("id", id);
  return c.json({ ok: true });
});

// ---- package instances ----------------------------------------------------
app.post(`${P}/packages`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { clientId, bundleTypeId, coachId } = await c.req.json();
  const result = await sellPackageTo(clientId, bundleTypeId, coachId, me);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json({ package: toPackageInstance(result.package) });
});

app.post(`${P}/packages/deliver`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { packageInstanceId } = await c.req.json();
  const { data: pkgRow, error } = await admin().from("package_instances").select("*").eq("id", packageInstanceId).eq("org_id", me.org_id).maybeSingle();
  if (error) throw error;
  if (!pkgRow) return c.json({ error: "No such package" }, 404);
  if (pkgRow.coach_id !== me.id) return c.json({ error: "Forbidden" }, 403);

  const pkg = await materializePackage(pkgRow);
  if (pkg.status !== "active") return c.json({ error: "This package isn't active." }, 400);

  const sessionsRemaining = pkg.sessions_remaining - 1;
  const status = sessionsRemaining <= 0 ? "exhausted" : "active";
  const { data: updated, error: uErr } = await admin()
    .from("package_instances")
    .update({ sessions_remaining: sessionsRemaining, status })
    .eq("id", pkg.id)
    .select()
    .single();
  if (uErr) throw uErr;

  await admin().from("delivery_logs").insert({ org_id: me.org_id, package_instance_id: pkg.id, date: todayIso(), logged_by: me.id });

  return c.json({ package: toPackageInstance(updated) });
});

// Coach payout drill-down (accountant/dept_head/head_coach): every private
// package this coach sold in a given month, enriched with the client and
// bundle names — client conditions are deliberately NOT included here, this
// is a finance view, not a client-management one.
app.get(`${P}/packages/by-coach/:coachId/:month`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  if (me.role !== "accountant" && me.role !== "dept_head" && me.role !== "head_coach") {
    return c.json({ error: "Forbidden" }, 403);
  }
  const coachId = c.req.param("coachId");
  const month = c.req.param("month");

  const { data: packages, error } = await admin()
    .from("package_instances")
    .select("*, clients(name), bundle_types(name)")
    .eq("org_id", me.org_id)
    .eq("coach_id", coachId);
  if (error) throw error;

  const mine = (packages ?? []).filter((p) => String(p.purchased_at).slice(0, 7) === month);
  const enriched = await Promise.all(
    mine.map(async (p) => {
      const materialized = await materializePackage(p);
      return {
        ...toPackageInstance(materialized),
        clientName: (p as any).clients?.name ?? "Unknown client",
        bundleName: (p as any).bundle_types?.name ?? "Unknown bundle",
      };
    }),
  );
  enriched.sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate));
  return c.json({ packages: enriched });
});

// ---- month rollups -----------------------------------------------------
async function monthRollups(orgId: string, profiles: any[], month: string) {
  const [tiersRes, settlementsRes, sessionsRes, packagesRes] = await Promise.all([
    admin().from("tiers").select("*").eq("org_id", orgId),
    admin().from("settlements").select("*").eq("org_id", orgId).eq("month", month),
    admin().from("sessions").select("coach_id").eq("org_id", orgId).eq("month", month),
    admin().from("package_instances").select("*").eq("org_id", orgId),
  ]);
  const tiers = tiersRes.data ?? [];
  const settlements = settlementsRes.data ?? [];
  const sessions = sessionsRes.data ?? [];
  const packages = packagesRes.data ?? [];

  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const settlementByCoach = new Map(settlements.map((s) => [s.coach_id, s]));
  const sessionCountByCoach = new Map<string, number>();
  for (const s of sessions) sessionCountByCoach.set(s.coach_id, (sessionCountByCoach.get(s.coach_id) ?? 0) + 1);

  // Private earnings attribute to the SALE month, regardless of the
  // package's current status — the coach's cut is final the moment it sells.
  const packagesSoldThisMonth = packages.filter((p) => String(p.purchased_at).slice(0, 7) === month);
  const privateByCoach = new Map<string, { total: number; count: number }>();
  for (const p of packagesSoldThisMonth) {
    const agg = privateByCoach.get(p.coach_id) ?? { total: 0, count: 0 };
    agg.total += Number(p.coach_cut_at_sale);
    agg.count += 1;
    privateByCoach.set(p.coach_id, agg);
  }

  return profiles.map((profile) => {
    const tier = profile.tier_id ? (tierById.get(profile.tier_id) ?? null) : null;
    const settlement = settlementByCoach.get(profile.id) ?? null;
    const state = stateOf(settlement);
    const count = sessionCountByCoach.get(profile.id) ?? 0;
    const rate = state === "logging" ? Number(tier?.hourly_rate ?? 0) : Number(settlement?.rate_snapshot ?? tier?.hourly_rate ?? 0);
    const groupTotal = rate * count;
    const livePrivate = privateByCoach.get(profile.id) ?? { total: 0, count: 0 };
    // Frozen at settle-time, same reasoning as rate: a package sold into an
    // already-settled month must not retroactively change it.
    const privateTotal = state === "logging" ? livePrivate.total : Number(settlement?.private_total ?? 0);
    const packageCount = livePrivate.count;
    return {
      coachId: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      avatarUrl: profile.avatar_url ?? null,
      tierId: profile.tier_id ?? null,
      tierName: tier?.name ?? null,
      rate,
      count,
      groupTotal,
      privateTotal,
      packageCount,
      total: groupTotal + privateTotal,
      state,
      settledAt: settlement?.settled_at ?? null,
      paidAt: settlement?.paid_at ?? null,
    };
  });
}

app.get(`${P}/month/:month`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const month = c.req.param("month");

  if (me.role === "coach") {
    const [row] = await monthRollups(me.org_id, [me], month);
    return c.json({ rows: [row] });
  }

  const { data: profiles, error } = await admin().from("profiles").select("*").eq("org_id", me.org_id).neq("role", "accountant");
  if (error) throw error;
  const rows = await monthRollups(me.org_id, profiles ?? [], month);
  rows.sort((a, b) => a.name.localeCompare(b.name));
  return c.json({ rows });
});

// ---- sessions ----------------------------------------------------------
function canMutateSessions(me: any, coachId: string) {
  if (me.role === "coach") return me.id === coachId;
  return me.role === "dept_head" || me.role === "head_coach";
}

app.get(`${P}/sessions/:coachId/:month`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const coachId = c.req.param("coachId");
  const month = c.req.param("month");
  if (me.role === "coach" && me.id !== coachId) return c.json({ error: "Forbidden" }, 403);
  if (me.role === "accountant") return c.json({ error: "Forbidden" }, 403);
  const { data, error } = await admin().from("sessions").select("*").eq("org_id", me.org_id).eq("coach_id", coachId).eq("month", month).order("date");
  if (error) throw error;
  return c.json({ sessions: (data ?? []).map(toSession) });
});

async function assertLoggable(orgId: string, coachId: string, month: string) {
  if (isFutureMonth(month)) return "This month hasn't started yet.";
  const { data: settlement } = await admin().from("settlements").select("*").eq("org_id", orgId).eq("coach_id", coachId).eq("month", month).maybeSingle();
  const state = stateOf(settlement);
  if (state !== "logging") return "This month is settled — reopen it to make changes.";
  return null;
}

app.post(`${P}/sessions/add`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { coachId, month, date } = await c.req.json();
  if (!canMutateSessions(me, coachId)) return c.json({ error: "Forbidden" }, 403);
  const blocked = await assertLoggable(me.org_id, coachId, month);
  if (blocked) return c.json({ error: blocked }, 400);
  const { data, error } = await admin().from("sessions").insert({ org_id: me.org_id, coach_id: coachId, month, date, created_by: me.id }).select().single();
  if (error) throw error;
  return c.json({ session: toSession(data) });
});

app.post(`${P}/sessions/edit`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { id, coachId, month, date } = await c.req.json();
  if (!canMutateSessions(me, coachId)) return c.json({ error: "Forbidden" }, 403);
  const blocked = await assertLoggable(me.org_id, coachId, month);
  if (blocked) return c.json({ error: blocked }, 400);
  const { data: existing } = await admin().from("sessions").select("id").eq("id", id).eq("org_id", me.org_id).maybeSingle();
  if (!existing) return c.json({ error: "No such session" }, 404);
  const { data, error } = await admin().from("sessions").update({ date }).eq("id", id).select().single();
  if (error) throw error;
  return c.json({ session: toSession(data) });
});

app.post(`${P}/sessions/remove`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { id, coachId, month } = await c.req.json();
  if (!canMutateSessions(me, coachId)) return c.json({ error: "Forbidden" }, 403);
  const blocked = await assertLoggable(me.org_id, coachId, month);
  if (blocked) return c.json({ error: blocked }, 400);
  await admin().from("sessions").delete().eq("id", id).eq("org_id", me.org_id);
  return c.json({ ok: true });
});

// ---- state transitions -------------------------------------------------
app.post(`${P}/settle`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  if (me.role !== "dept_head" && me.role !== "head_coach") return c.json({ error: "Forbidden" }, 403);
  const { coachId, month } = await c.req.json();
  if (isFutureMonth(month)) return c.json({ error: "This month hasn't started yet." }, 400);

  const { data: existingSettlement } = await admin().from("settlements").select("*").eq("org_id", me.org_id).eq("coach_id", coachId).eq("month", month).maybeSingle();
  if (stateOf(existingSettlement) !== "logging") return c.json({ error: "Already settled." }, 400);

  const coach = await profileOf(coachId);
  const tier = coach?.tier_id ? await tierOf(coach.tier_id) : null;
  const { data: sessions } = await admin().from("sessions").select("id").eq("org_id", me.org_id).eq("coach_id", coachId).eq("month", month);
  const { data: packages } = await admin().from("package_instances").select("coach_cut_at_sale, purchased_at").eq("org_id", me.org_id).eq("coach_id", coachId);
  const privateTotalSnapshot = (packages ?? [])
    .filter((p) => String(p.purchased_at).slice(0, 7) === month)
    .reduce((s, p) => s + Number(p.coach_cut_at_sale), 0);

  const { data: settlement, error } = await admin()
    .from("settlements")
    .insert({
      org_id: me.org_id,
      coach_id: coachId,
      month,
      rate_snapshot: Number(tier?.hourly_rate ?? 0),
      count_snapshot: (sessions ?? []).length,
      private_total: privateTotalSnapshot,
      settled_by: me.id,
      settled_at: new Date().toISOString(),
      paid_by: null,
      paid_at: null,
    })
    .select()
    .single();
  if (error) throw error;

  if (coach) {
    await sendPushToProfile(me.org_id, coachId, "month_settled", {
      title: "💰 Month settled",
      body: `Your account for ${month} has been settled. Tap here to view the details.`,
      url: homePathForRole(coach.role),
    });
  }

  return c.json({ settlement: toSettlement(settlement) });
});

app.post(`${P}/reopen`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  if (me.role !== "dept_head" && me.role !== "head_coach") return c.json({ error: "Forbidden" }, 403);
  const { coachId, month } = await c.req.json();
  const { data: settlement } = await admin().from("settlements").select("*").eq("org_id", me.org_id).eq("coach_id", coachId).eq("month", month).maybeSingle();
  const state = stateOf(settlement);
  if (state === "paid") return c.json({ error: "Paid months are locked." }, 400);
  if (state !== "settled") return c.json({ error: "Nothing to reopen." }, 400);
  await admin().from("settlements").delete().eq("id", settlement.id);
  return c.json({ ok: true });
});

app.post(`${P}/pay`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  if (me.role !== "accountant") return c.json({ error: "Forbidden" }, 403);
  const { coachId, month } = await c.req.json();
  const { data: settlement } = await admin().from("settlements").select("*").eq("org_id", me.org_id).eq("coach_id", coachId).eq("month", month).maybeSingle();
  const state = stateOf(settlement);
  if (state !== "settled") return c.json({ error: "Coach isn't ready to pay." }, 400);
  const { data: updated, error } = await admin()
    .from("settlements")
    .update({ paid_by: me.id, paid_at: new Date().toISOString() })
    .eq("id", settlement.id)
    .select()
    .single();
  if (error) throw error;
  return c.json({ settlement: toSettlement(updated) });
});

Deno.serve(app.fetch);

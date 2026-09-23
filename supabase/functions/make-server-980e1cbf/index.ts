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

// A bizqwik_team member's row is keyed on their auth uid (same id), so this
// doubles as "is the caller Bizqwik team." They have no org and run the ops
// dashboard, not any single gym.
async function bizqwikTeamOf(userId: string) {
  const { data } = await admin().from("bizqwik_team").select("*").eq("id", userId).maybeSingle();
  return data;
}
function toBizqwikTeam(row: any) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

// A SaaS plan caps an org's team size and client count. Null limit (or no plan
// assigned) = unlimited, so orgs without a plan — like Revolt today — are never
// blocked. Returns a friendly message when the cap is already reached, else null.
async function planLimitError(orgId: string, kind: "team" | "client"): Promise<string | null> {
  const { data: org } = await admin().from("organizations").select("plan_id").eq("id", orgId).maybeSingle();
  if (!org?.plan_id) return null;
  const { data: plan } = await admin().from("plan_types").select("*").eq("id", org.plan_id).maybeSingle();
  if (!plan) return null;

  if (kind === "team") {
    const limit = plan.team_size_limit;
    if (limit === null || limit === undefined) return null;
    const [profiles, invites] = await Promise.all([
      admin().from("profiles").select("id").eq("org_id", orgId),
      admin().from("staff_invitations").select("id").eq("org_id", orgId),
    ]);
    const used = (profiles.data?.length ?? 0) + (invites.data?.length ?? 0);
    if (used >= limit) return `This org is on the ${plan.name} plan, which allows up to ${limit} staff. Upgrade the plan to add more.`;
    return null;
  }

  const limit = plan.client_size_limit;
  if (limit === null || limit === undefined) return null;
  const { data: clients } = await admin().from("clients").select("id").eq("org_id", orgId);
  if ((clients?.length ?? 0) >= limit) return `This org is on the ${plan.name} plan, which allows up to ${limit} clients. Upgrade the plan to add more.`;
  return null;
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

// Same lazy-expiry approach as packages: a membership past its end date is
// flipped to expired the first time anything reads it.
async function materializeMembership(m: any): Promise<any> {
  if (m.status === "active" && todayIso() > String(m.expires_at).slice(0, 10)) {
    const { data: updated, error } = await admin().from("membership_instances").update({ status: "expired" }).eq("id", m.id).select().single();
    if (error) throw error;
    return updated;
  }
  return m;
}

async function currentMembershipForClient(clientId: string, orgId: string) {
  const { data, error } = await admin()
    .from("membership_instances")
    .select("*")
    .eq("client_id", clientId)
    .eq("org_id", orgId)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return await materializeMembership(data);
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
function toClient(row: any, conditions: string | null, currentPackage: any, currentMembership: any = null) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    phone: row.phone ?? null,
    email: row.email ?? null,
    conditions,
    assignedCoachId: row.assigned_coach_id,
    currentPackage,
    currentMembership,
  };
}
function toMembershipType(row: any) {
  return {
    id: row.id,
    name: row.name,
    durationDays: row.duration_days,
    price: Number(row.price),
    invitationsAllowance: row.invitations_allowance,
  };
}
function toMembershipInstance(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    membershipTypeId: row.membership_type_id,
    startDate: String(row.starts_at).slice(0, 10),
    expiryDate: String(row.expires_at).slice(0, 10),
    status: row.status,
    invitationsRemaining: row.invitations_remaining,
  };
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
// Locked to invited emails only, and multi-org aware: the org (or Bizqwik-team
// membership) a new account joins is decided entirely by which invite their
// email matches — never by "the one org that exists," since there can now be
// many. A Bizqwik-team invite creates a team member (no org, no profile); a
// staff invite creates that org's profile. No match → rejected before any auth
// user is created.
app.post(`${P}/signup`, async (c) => {
  try {
    const { name, email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: "Email and password required" }, 400);
    const normalizedEmail = String(email).toLowerCase();
    const displayName = String(name ?? "").trim() || email;

    const { data: teamInvite } = await admin().from("bizqwik_team_invitations").select("*").eq("email", normalizedEmail).maybeSingle();
    const { data: staffInvite } = teamInvite
      ? { data: null }
      : await admin().from("staff_invitations").select("*").eq("email", normalizedEmail).maybeSingle();
    if (!teamInvite && !staffInvite) return c.json({ error: "You're not part of this organization." }, 403);

    const { data: created, error: cErr } = await admin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (cErr || !created?.user) return c.json({ error: cErr?.message || "Sign up failed" }, 400);
    const uid = created.user.id;

    if (teamInvite) {
      const { data: member, error: mErr } = await admin()
        .from("bizqwik_team")
        .insert({ id: uid, name: displayName, email: normalizedEmail, role: teamInvite.role, invited_by: teamInvite.invited_by })
        .select()
        .single();
      if (mErr) throw mErr;
      await admin().from("bizqwik_team_invitations").delete().eq("id", teamInvite.id);
      return c.json({ bizqwikTeam: toBizqwikTeam(member) });
    }

    const { data: profile, error: pErr } = await admin()
      .from("profiles")
      .insert({ id: uid, org_id: staffInvite.org_id, role: staffInvite.role, name: displayName, email, tier_id: staffInvite.tier_id, avatar_url: null })
      .select()
      .single();
    if (pErr) throw pErr;
    await admin().from("staff_invitations").delete().eq("id", staffInvite.id);

    return c.json({ profile: toProfile(profile) });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ---- me ----------------------------------------------------------------
// Returns whichever identities the caller holds: an org profile (staff) and/or
// bizqwik_team membership (ops). At least one must exist.
app.get(`${P}/me`, async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const [profile, team] = await Promise.all([profileOf(user.id), bizqwikTeamOf(user.id)]);
  if (!profile && !team) return c.json({ error: "No profile" }, 404);
  const tier = profile?.tier_id ? await tierOf(profile.tier_id) : null;
  return c.json({
    profile: profile ? toProfile(profile) : null,
    tier: tier ? toTier(tier) : null,
    bizqwikTeam: team ? toBizqwikTeam(team) : null,
  });
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

  // A device's endpoint is normally stable across resubscribes (same
  // deviceId, upsert overwrites in place) — but iOS/Safari can silently
  // rotate it, and a stale pre-fix row (different id, same endpoint) can
  // still be sitting around from before deviceId existed. Either way, if
  // some OTHER row for this profile already points at this endpoint, it's
  // now stale — clear it first so it can never collide with the
  // unique(profile_id, endpoint) constraint below, and this profile never
  // ends up with two rows delivering to the same physical device.
  await admin().from("push_subscriptions").delete().eq("profile_id", me.id).eq("endpoint", endpoint).neq("id", deviceId);

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
// logged one yet today, per organization. Accountant and front_desk are
// deliberately excluded — the app gives those roles no way to log a session
// at all, so the reminder would just be noise for them.
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
      admin().from("profiles").select("*").eq("org_id", org.id).in("role", ["coach", "head_coach", "dept_head"]),
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

  const [assignedProfiles, pendingInvites] = await Promise.all([
    admin().from("profiles").select("id").eq("tier_id", id).eq("org_id", me.org_id),
    admin().from("staff_invitations").select("id").eq("tier_id", id).eq("org_id", me.org_id),
  ]);
  if ((assignedProfiles.data?.length ?? 0) > 0 || (pendingInvites.data?.length ?? 0) > 0) {
    return c.json({ error: "Reassign anyone on this tier (and any pending invites for it) before deleting it." }, 400);
  }

  const { error } = await admin().from("tiers").delete().eq("id", id).eq("org_id", me.org_id);
  if (error) throw error;
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

  const { data: sold } = await admin().from("package_instances").select("id").eq("bundle_type_id", id).eq("org_id", me.org_id);
  if ((sold?.length ?? 0) > 0) {
    return c.json({ error: "This bundle type has already been sold, so it can't be deleted — edit it instead, or leave it in place." }, 400);
  }

  const { error } = await admin().from("bundle_types").delete().eq("id", id).eq("org_id", me.org_id);
  if (error) throw error;
  return c.json({ ok: true });
});

// ---- membership types ----------------------------------------------------
app.get(`${P}/membership-types`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { data, error } = await admin().from("membership_types").select("*").eq("org_id", me.org_id).order("name");
  if (error) throw error;
  return c.json({ membershipTypes: (data ?? []).map(toMembershipType) });
});

function membershipTypeFields(body: any) {
  const name = String(body.name ?? "").trim();
  const durationDays = Number(body.durationDays);
  const price = Number(body.price);
  const invitationsAllowance = Number(body.invitationsAllowance ?? 0);
  if (!name) return { error: "Name is required." } as const;
  if (!Number.isInteger(durationDays) || durationDays <= 0) return { error: "Duration must be a whole number of days." } as const;
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be zero or more." } as const;
  if (!Number.isInteger(invitationsAllowance) || invitationsAllowance < 0) return { error: "Invitations must be a whole number, zero or more." } as const;
  return { row: { name, duration_days: durationDays, price, invitations_allowance: invitationsAllowance } } as const;
}

app.post(`${P}/membership-types`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const parsed = membershipTypeFields(await c.req.json());
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { data, error } = await admin().from("membership_types").insert({ org_id: me.org_id, ...parsed.row }).select().single();
  if (error) throw error;
  return c.json({ membershipType: toMembershipType(data) });
});

app.post(`${P}/membership-types/update`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const parsed = membershipTypeFields(body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { data, error } = await admin().from("membership_types").update(parsed.row).eq("id", body.id).eq("org_id", me.org_id).select().maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: "No such membership type" }, 404);
  return c.json({ membershipType: toMembershipType(data) });
});

app.post(`${P}/membership-types/delete`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  const { data: sold } = await admin().from("membership_instances").select("id").eq("membership_type_id", id).eq("org_id", me.org_id).limit(1);
  if ((sold?.length ?? 0) > 0) {
    return c.json({ error: "This membership has already been sold, so it can't be deleted — edit it instead, or leave it in place." }, 400);
  }
  const { error } = await admin().from("membership_types").delete().eq("id", id).eq("org_id", me.org_id);
  if (error) throw error;
  return c.json({ ok: true });
});

// ---- coach picker ----------------------------------------------------------
// Names only — for roles that assign clients to coaches but must not see
// payout data (front_desk can't use /month, which carries earnings).
app.get(`${P}/coaches`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { data, error } = await admin()
    .from("profiles")
    .select("id, name, avatar_url")
    .eq("org_id", me.org_id)
    .in("role", ["coach", "head_coach"])
    .order("name");
  if (error) throw error;
  return c.json({ coaches: (data ?? []).map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatar_url ?? null })) });
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
  const limitErr = await planLimitError(me.org_id, "team");
  if (limitErr) return c.json({ error: limitErr }, 400);
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

  // Every FK into profiles is NO ACTION (no cascade), so this has to clear
  // every reference by hand before the row itself can go. Split into two
  // buckets: rows that are unambiguously this profile's own (safe to
  // delete outright) vs. rows where they merely acted on someone ELSE's
  // record (settled/paid/logged/sold on another coach's behalf) — deleting
  // those would destroy a different, still-active coach's real history, so
  // removal is blocked instead, same as the existing "reassign clients
  // first" rule below.
  const { data: assignedClients } = await admin().from("clients").select("id").eq("assigned_coach_id", id).eq("org_id", me.org_id);
  if (assignedClients && assignedClients.length > 0) {
    return c.json({ error: `Reassign ${assignedClients.length} client(s) to another coach before removing this profile.` }, 400);
  }

  const [otherSessions, otherSettled, otherPaid, otherPackages] = await Promise.all([
    admin().from("sessions").select("id").eq("created_by", id).neq("coach_id", id).eq("org_id", me.org_id),
    admin().from("settlements").select("id").eq("settled_by", id).neq("coach_id", id).eq("org_id", me.org_id),
    admin().from("settlements").select("id").eq("paid_by", id).neq("coach_id", id).eq("org_id", me.org_id),
    admin().from("package_instances").select("id").eq("created_by", id).neq("coach_id", id).eq("org_id", me.org_id),
  ]);
  const hasOtherRecords =
    (otherSessions.data?.length ?? 0) > 0 ||
    (otherSettled.data?.length ?? 0) > 0 ||
    (otherPaid.data?.length ?? 0) > 0 ||
    (otherPackages.data?.length ?? 0) > 0;
  if (hasOtherRecords) {
    return c.json({ error: "This profile has logged, settled, or sold packages on behalf of other coaches, so it can't be removed while those records exist." }, 400);
  }

  const { data: ownPackages } = await admin().from("package_instances").select("id").eq("coach_id", id).eq("org_id", me.org_id);
  for (const pkg of ownPackages ?? []) {
    await admin().from("delivery_logs").delete().eq("package_instance_id", pkg.id);
  }
  await admin().from("package_instances").delete().eq("coach_id", id).eq("org_id", me.org_id);
  await admin().from("notification_log").delete().eq("profile_id", id);
  await admin().from("staff_invitations").delete().eq("invited_by", id).eq("org_id", me.org_id);
  await admin().from("sessions").delete().eq("coach_id", id).eq("org_id", me.org_id);
  await admin().from("settlements").delete().eq("coach_id", id).eq("org_id", me.org_id);
  await admin().from("push_subscriptions").delete().eq("profile_id", id);

  const { error: profileErr } = await admin().from("profiles").delete().eq("id", id);
  if (profileErr) throw profileErr;

  const { error: authErr } = await admin().auth.admin.deleteUser(id);
  if (authErr) throw authErr;

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

  // dept_head and front_desk see the full roster; head_coach's
  // private-training access is limited to their own assigned clients
  // (deliver-only, no assign/reassign), same scoping as a plain coach.
  const fullRoster = me.role === "dept_head" || me.role === "front_desk";
  let query = admin().from("clients").select("*").eq("org_id", me.org_id);
  if (!fullRoster) query = query.eq("assigned_coach_id", me.id);
  const { data: clients, error } = await query.order("name");
  if (error) throw error;

  // Medical conditions stay with the assigned coach and heads only — for
  // front_desk they're never even read, not just hidden in the UI.
  const canSeeConditions = me.role !== "front_desk";
  const rows = await Promise.all(
    (clients ?? []).map(async (cl) => {
      const [pkg, membership, conditions] = await Promise.all([
        currentPackageForClient(cl.id, me.org_id),
        currentMembershipForClient(cl.id, me.org_id),
        canSeeConditions ? conditionsOf(cl.id) : Promise.resolve(null),
      ]);
      return toClient(cl, conditions, pkg ? toPackageInstance(pkg) : null, membership ? toMembershipInstance(membership) : null);
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

const blankToNull = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

async function insertClient(me: any, fields: { name: string; age?: unknown; phone?: unknown; email?: unknown }) {
  const { data, error } = await admin()
    .from("clients")
    .insert({
      org_id: me.org_id,
      name: fields.name.trim(),
      age: blankToNull(fields.age) === null ? null : Number(fields.age),
      phone: blankToNull(fields.phone),
      email: blankToNull(fields.email),
      assigned_coach_id: null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

app.post(`${P}/clients`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const { name, age, phone, email, bundleTypeId, coachId } = body;
  // front_desk never writes medical conditions, even if a payload carries them.
  const conditions = me.role === "front_desk" ? null : body.conditions;
  if (!name || !String(name).trim() || !bundleTypeId || !coachId) {
    return c.json({ error: "Name, bundle, and coach are all required to create a client." }, 400);
  }
  const limitErr = await planLimitError(me.org_id, "client");
  if (limitErr) return c.json({ error: limitErr }, 400);

  const client = await insertClient(me, { name, age, phone, email });

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

  // Every FK into clients is NO ACTION, so each referencing row is cleared by
  // hand first. Drop-ins are revenue records — they're kept and unlinked
  // (client_id is nullable) rather than deleted.
  const { data: packages } = await admin().from("package_instances").select("id").eq("client_id", id);
  for (const pkg of packages ?? []) {
    await admin().from("delivery_logs").delete().eq("package_instance_id", pkg.id);
  }
  await admin().from("package_instances").delete().eq("client_id", id);
  await admin().from("membership_instances").delete().eq("client_id", id);
  await admin().from("check_ins").delete().eq("client_id", id);
  await admin().from("invitations").delete().eq("member_id", id);
  await admin().from("drop_ins").update({ client_id: null }).eq("client_id", id);
  await admin().from("wallet_transactions").delete().eq("client_id", id);
  await admin().from("wallets").delete().eq("client_id", id);
  await admin().from("points_ledger").delete().eq("client_id", id);
  await admin().from("points_balances").delete().eq("client_id", id);
  await admin().from("client_notes").delete().eq("client_id", id);
  const { error } = await admin().from("clients").delete().eq("id", id);
  if (error) throw error;
  return c.json({ ok: true });
});

// ---- package instances ----------------------------------------------------
app.post(`${P}/packages`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { clientId, bundleTypeId, coachId } = await c.req.json();
  const result = await sellPackageTo(clientId, bundleTypeId, coachId, me);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  return c.json({ package: toPackageInstance(result.package) });
});

// Assign (or change) a client's coach outside of a package sale — e.g. a
// membership-only client. Blocked while a package is running: the coach on
// an active package is locked in until it's finished.
app.post(`${P}/clients/assign-coach`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { id, coachId } = await c.req.json();
  const { data: client } = await admin().from("clients").select("*").eq("id", id).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "No such client" }, 404);
  const coach = coachId ? await profileOf(coachId) : null;
  if (!coach || coach.org_id !== me.org_id || (coach.role !== "coach" && coach.role !== "head_coach")) {
    return c.json({ error: "No such coach" }, 404);
  }
  if (client.assigned_coach_id === coachId) return c.json({ client: toClient(client, null, null) });

  const pkg = await currentPackageForClient(id, me.org_id);
  if (pkg && pkg.status === "active") {
    return c.json({ error: "This client is mid-package — their coach can only change once the current package is finished." }, 400);
  }

  const { data: updated, error } = await admin().from("clients").update({ assigned_coach_id: coachId }).eq("id", id).select().single();
  if (error) throw error;
  await sendPushToProfile(me.org_id, coachId, "new_client_assigned", {
    title: "🎉 New client assigned!",
    body: `${client.name} was just assigned to you. Welcome them aboard!`,
    url: "/clients",
  });
  return c.json({ client: toClient(updated, null, null) });
});

// ---- memberships (front desk) ----------------------------------------------
// Sell a membership to an existing client (renewal) or a brand-new one.
// Renewal is only allowed once the current membership has ended — the same
// "only when finished" rule sellPackageTo applies to packages.
app.post(`${P}/memberships/sell`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { clientId, name, age, phone, email, membershipTypeId } = await c.req.json();

  const { data: type } = await admin().from("membership_types").select("*").eq("id", membershipTypeId).eq("org_id", me.org_id).maybeSingle();
  if (!type) return c.json({ error: "Choose a membership." }, 400);

  let client: any;
  let createdNow = false;
  if (clientId) {
    const { data } = await admin().from("clients").select("*").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
    if (!data) return c.json({ error: "No such client" }, 404);
    client = data;
    const current = await currentMembershipForClient(clientId, me.org_id);
    if (current && current.status === "active") {
      return c.json({ error: `${client.name} already has an active membership until ${String(current.expires_at).slice(0, 10)}.` }, 400);
    }
  } else {
    if (!name || !String(name).trim()) return c.json({ error: "Name is required." }, 400);
    const limitErr = await planLimitError(me.org_id, "client");
    if (limitErr) return c.json({ error: limitErr }, 400);
    client = await insertClient(me, { name, age, phone, email });
    createdNow = true;
  }

  const start = todayIso();
  const { data: membership, error } = await admin()
    .from("membership_instances")
    .insert({
      org_id: me.org_id,
      client_id: client.id,
      membership_type_id: type.id,
      starts_at: `${start}T00:00:00Z`,
      expires_at: `${addDays(start, Number(type.duration_days))}T00:00:00Z`,
      status: "active",
      invitations_remaining: Number(type.invitations_allowance ?? 0),
    })
    .select()
    .single();
  if (error) {
    if (createdNow) await admin().from("clients").delete().eq("id", client.id);
    throw error;
  }
  return c.json({ client: toClient(client, null, null, toMembershipInstance(membership)), membership: toMembershipInstance(membership) });
});

// ---- check-ins, drop-ins, invitations (front desk) -------------------------
async function clientPlanStatus(clientId: string, orgId: string) {
  const [membership, pkg] = await Promise.all([currentMembershipForClient(clientId, orgId), currentPackageForClient(clientId, orgId)]);
  const activeMembership = membership && membership.status === "active" ? membership : null;
  const activePackage = pkg && pkg.status === "active" ? pkg : null;
  return {
    membership: membership ? toMembershipInstance(membership) : null,
    package: pkg ? toPackageInstance(pkg) : null,
    eligible: !!(activeMembership || activePackage),
  };
}

app.get(`${P}/front-desk/client-status/:id`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: "That code isn't a Bizqwik member code." }, 404);
  const { data: client } = await admin().from("clients").select("*").eq("id", id).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "Member not found. Please check the QR code." }, 404);
  const status = await clientPlanStatus(id, me.org_id);
  return c.json({ client: toClient(client, null, status.package, status.membership), eligible: status.eligible });
});

app.post(`${P}/check-ins`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { clientId, source } = await c.req.json();
  if (source !== "qr" && source !== "manual") return c.json({ error: "Invalid check-in source." }, 400);
  const { data: client } = await admin().from("clients").select("id, name").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "No such client" }, 404);
  const status = await clientPlanStatus(clientId, me.org_id);
  if (!status.eligible) return c.json({ error: `${client.name} has no active membership or package.` }, 400);
  const { data, error } = await admin().from("check_ins").insert({ org_id: me.org_id, client_id: clientId, source }).select().single();
  if (error) throw error;
  return c.json({ checkIn: { id: data.id, clientId: data.client_id, source: data.source, checkedInAt: data.checked_in_at } });
});

app.post(`${P}/drop-ins`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { clientId, category, price } = await c.req.json();
  const cat = String(category ?? "").trim();
  const amount = Number(price);
  if (!cat) return c.json({ error: "Enter what the drop-in is for." }, 400);
  if (!Number.isFinite(amount) || amount < 0) return c.json({ error: "Enter a valid price." }, 400);
  if (clientId) {
    const { data: client } = await admin().from("clients").select("id").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
    if (!client) return c.json({ error: "No such client" }, 404);
  }
  const { data, error } = await admin()
    .from("drop_ins")
    .insert({ org_id: me.org_id, client_id: clientId || null, category: cat, price: amount })
    .select()
    .single();
  if (error) throw error;
  return c.json({ dropIn: { id: data.id, clientId: data.client_id, category: data.category, price: Number(data.price), createdAt: data.created_at } });
});

app.post(`${P}/invitations`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { clientId, inviteeName, inviteePhone, visitDate } = await c.req.json();
  if (!String(inviteeName ?? "").trim() || !String(inviteePhone ?? "").trim() || !visitDate) {
    return c.json({ error: "Name, phone and visit date are all required." }, 400);
  }
  if (String(visitDate) < todayIso()) return c.json({ error: "The visit date can't be in the past." }, 400);

  const { data: client } = await admin().from("clients").select("id, name").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "No such client" }, 404);
  const membership = await currentMembershipForClient(clientId, me.org_id);
  if (!membership || membership.status !== "active") return c.json({ error: `${client.name} doesn't have an active membership.` }, 400);
  if (membership.invitations_remaining <= 0) return c.json({ error: `${client.name} has no invitations left on this membership.` }, 400);

  // Compare-and-set on the old count so two simultaneous invites can't both
  // spend the last one.
  const { data: spent, error: sErr } = await admin()
    .from("membership_instances")
    .update({ invitations_remaining: membership.invitations_remaining - 1 })
    .eq("id", membership.id)
    .eq("invitations_remaining", membership.invitations_remaining)
    .select()
    .maybeSingle();
  if (sErr) throw sErr;
  if (!spent) return c.json({ error: "That invitation was just used — try again." }, 409);

  const { data: invitation, error } = await admin()
    .from("invitations")
    .insert({
      org_id: me.org_id,
      member_id: clientId,
      invitee_name: String(inviteeName).trim(),
      invitee_phone: String(inviteePhone).trim(),
      visit_date: visitDate,
    })
    .select()
    .single();
  if (error) {
    await admin().from("membership_instances").update({ invitations_remaining: membership.invitations_remaining }).eq("id", membership.id);
    throw error;
  }
  return c.json({
    invitation: {
      id: invitation.id,
      memberId: invitation.member_id,
      inviteeName: invitation.invitee_name,
      inviteePhone: invitation.invitee_phone,
      visitDate: invitation.visit_date,
      createdAt: invitation.created_at,
    },
    invitationsRemaining: spent.invitations_remaining,
  });
});

// Home-screen numbers from real rows. There's no check-out tracking, so
// "active now" means checked in (or dropped in) within the last 2 hours.
app.get(`${P}/front-desk/summary`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const dayStart = `${todayIso()}T00:00:00Z`;
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const recentEnough = (ts: string) => Date.parse(ts) >= twoHoursAgo;
  const [checkIns, dropIns] = await Promise.all([
    admin().from("check_ins").select("id, client_id, checked_in_at, clients(name)").eq("org_id", me.org_id).gte("checked_in_at", dayStart).order("checked_in_at", { ascending: false }),
    admin().from("drop_ins").select("id, client_id, category, created_at, clients(name)").eq("org_id", me.org_id).gte("created_at", dayStart).order("created_at", { ascending: false }),
  ]);
  if (checkIns.error) throw checkIns.error;
  if (dropIns.error) throw dropIns.error;
  const ci = checkIns.data ?? [];
  const di = dropIns.data ?? [];
  const recent = [
    ...ci.map((r: any) => ({ id: r.id, kind: "check_in", name: r.clients?.name ?? "Unknown client", detail: "Checked in", at: r.checked_in_at })),
    ...di.map((r: any) => ({ id: r.id, kind: "drop_in", name: r.clients?.name ?? "Walk-in", detail: `Drop-in · ${r.category}`, at: r.created_at })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 8);
  return c.json({
    todayCheckIns: ci.length,
    todayDropIns: di.length,
    activeNow: ci.filter((r: any) => recentEnough(r.checked_in_at)).length + di.filter((r: any) => recentEnough(r.created_at)).length,
    recent,
  });
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
  // Payout data — front_desk has no business seeing anyone's earnings.
  if (me.role === "front_desk") return c.json({ error: "Forbidden" }, 403);

  if (me.role === "coach") {
    const [row] = await monthRollups(me.org_id, [me], month);
    return c.json({ rows: [row] });
  }

  const { data: profiles, error } = await admin()
    .from("profiles")
    .select("*")
    .eq("org_id", me.org_id)
    .in("role", ["coach", "head_coach", "dept_head"]);
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
  if (me.role === "accountant" || me.role === "front_desk") return c.json({ error: "Forbidden" }, 403);
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

// ================= Bizqwik ops dashboard (bizqwik_team only) =================
// A bizqwik_team member runs Bizqwik itself, across every org. These endpoints
// are gated on team membership (not any org role) and use the service-role
// client to read/write across orgs, the same shape as `is_bizqwik_team()`'s
// RLS bypass but enforced here in code.
const OPS_ORG_STATUSES = ["trial", "active", "paused"];
const OPS_INVITE_ROLES = ["ops_manager", "teammate"];

function toPlanType(row: any) {
  return { id: row.id, name: row.name, price: Number(row.price), teamSizeLimit: row.team_size_limit, clientSizeLimit: row.client_size_limit };
}

async function gmvByOrg(): Promise<Map<string, number>> {
  const [pkgs, mems, memTypes, drops] = await Promise.all([
    admin().from("package_instances").select("org_id, price_at_sale"),
    admin().from("membership_instances").select("org_id, membership_type_id"),
    admin().from("membership_types").select("id, price"),
    admin().from("drop_ins").select("org_id, price"),
  ]);
  const priceOfType = new Map((memTypes.data ?? []).map((t: any) => [t.id, Number(t.price)]));
  const m = new Map<string, number>();
  const add = (org: string, v: number) => m.set(org, (m.get(org) ?? 0) + v);
  for (const p of pkgs.data ?? []) add(p.org_id, Number(p.price_at_sale));
  for (const mi of mems.data ?? []) add(mi.org_id, priceOfType.get(mi.membership_type_id) ?? 0);
  for (const d of drops.data ?? []) add(d.org_id, Number(d.price));
  return m;
}

async function countsByOrg(): Promise<{ staff: Map<string, number>; clients: Map<string, number> }> {
  const [profiles, clients] = await Promise.all([
    admin().from("profiles").select("org_id"),
    admin().from("clients").select("org_id"),
  ]);
  const tally = (rows: any[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.org_id, (m.get(r.org_id) ?? 0) + 1);
    return m;
  };
  return { staff: tally(profiles.data ?? []), clients: tally(clients.data ?? []) };
}

app.get(`${P}/ops/summary`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);

  const [{ data: orgs }, { data: plans }, gmv] = await Promise.all([
    admin().from("organizations").select("id, status, plan_id"),
    admin().from("plan_types").select("id, price"),
    gmvByOrg(),
  ]);
  const priceOfPlan = new Map((plans ?? []).map((p: any) => [p.id, Number(p.price)]));
  const activeOrgs = (orgs ?? []).filter((o: any) => o.status === "active");
  const bizqwikRevenue = activeOrgs.reduce((s: number, o: any) => s + (o.plan_id ? (priceOfPlan.get(o.plan_id) ?? 0) : 0), 0);
  let totalGmv = 0;
  for (const v of gmv.values()) totalGmv += v;
  return c.json({
    totalOrgs: (orgs ?? []).length,
    activeOrgs: activeOrgs.length,
    totalGmv,
    bizqwikRevenue,
  });
});

app.get(`${P}/ops/orgs`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);

  const [{ data: orgs }, { data: plans }, gmv, counts] = await Promise.all([
    admin().from("organizations").select("*").order("created_at"),
    admin().from("plan_types").select("id, name"),
    gmvByOrg(),
    countsByOrg(),
  ]);
  const planName = new Map((plans ?? []).map((p: any) => [p.id, p.name]));
  return c.json({
    orgs: (orgs ?? []).map((o: any) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      status: o.status,
      planId: o.plan_id ?? null,
      planName: o.plan_id ? (planName.get(o.plan_id) ?? null) : null,
      staffCount: counts.staff.get(o.id) ?? 0,
      clientCount: counts.clients.get(o.id) ?? 0,
      gmv: gmv.get(o.id) ?? 0,
    })),
  });
});

app.post(`${P}/ops/orgs`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);

  const { name, slug, planId, deptHeadName, deptHeadEmail } = await c.req.json();
  const orgName = String(name ?? "").trim();
  const orgSlug = String(slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
  const headEmail = String(deptHeadEmail ?? "").trim().toLowerCase();
  if (!orgName) return c.json({ error: "Organization name is required." }, 400);
  if (!orgSlug) return c.json({ error: "A URL slug (letters, numbers, dashes) is required." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(headEmail)) return c.json({ error: "A valid department-head email is required." }, 400);

  const { data: clash } = await admin().from("organizations").select("id").eq("slug", orgSlug).maybeSingle();
  if (clash) return c.json({ error: "That slug is already taken." }, 400);

  const { data: org, error: oErr } = await admin()
    .from("organizations")
    .insert({ name: orgName, slug: orgSlug, status: "trial", plan_id: planId || null, created_by: team.id })
    .select()
    .single();
  if (oErr) throw oErr;

  // Same starter tiers the old first-account bootstrap seeded, so a new org's
  // dept_head lands with something to assign coaches to (all editable).
  await admin().from("tiers").insert([
    { org_id: org.id, name: "Tier 1", hourly_rate: 150, private_cut_pct: 50 },
    { org_id: org.id, name: "Tier 2", hourly_rate: 250, private_cut_pct: 50 },
  ]);

  // invited_by is left null: staff_invitations.invited_by references
  // profiles(id), and a bizqwik_team member (the ops actor) has no org profile,
  // so team.id would violate that FK. Surface any failure instead of swallowing
  // it — a created org whose dept_head can't sign up is worse than a loud error.
  const { error: invErr } = await admin().from("staff_invitations").upsert(
    { org_id: org.id, email: headEmail, role: "dept_head", tier_id: null, invited_by: null },
    { onConflict: "org_id,email" },
  );
  if (invErr) throw invErr;

  return c.json({ org: { id: org.id, name: org.name, slug: org.slug, status: org.status, planId: org.plan_id ?? null }, deptHeadEmail: headEmail });
});

app.get(`${P}/ops/orgs/:id`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");

  const { data: org } = await admin().from("organizations").select("*").eq("id", id).maybeSingle();
  if (!org) return c.json({ error: "No such organization" }, 404);
  const plan = org.plan_id ? (await admin().from("plan_types").select("*").eq("id", org.plan_id).maybeSingle()).data : null;

  const [staff, sessions, packages, memberships, dropIns, pendingInvites] = await Promise.all([
    admin().from("profiles").select("*").eq("org_id", id).order("name"),
    admin().from("sessions").select("id, created_at").eq("org_id", id),
    admin().from("package_instances").select("id, price_at_sale, created_at").eq("org_id", id),
    admin().from("membership_instances").select("id, membership_type_id, created_at").eq("org_id", id),
    admin().from("drop_ins").select("id, price, created_at").eq("org_id", id),
    admin().from("staff_invitations").select("email, role").eq("org_id", id),
  ]);
  const gmv = (await gmvByOrg()).get(id) ?? 0;
  const times = [...(sessions.data ?? []), ...(packages.data ?? []), ...(memberships.data ?? []), ...(dropIns.data ?? [])]
    .map((r: any) => r.created_at)
    .filter(Boolean)
    .sort((a: string, b: string) => Date.parse(b) - Date.parse(a));

  return c.json({
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      planId: org.plan_id ?? null,
      planName: plan?.name ?? null,
      createdAt: org.created_at,
    },
    plan: plan ? toPlanType(plan) : null,
    staff: (staff.data ?? []).map(toProfile),
    pendingInvites: (pendingInvites.data ?? []).map((i: any) => ({ email: i.email, role: i.role })),
    usage: {
      staffCount: (staff.data ?? []).length,
      clientCount: (await admin().from("clients").select("id").eq("org_id", id)).data?.length ?? 0,
      sessionsLogged: (sessions.data ?? []).length,
      packagesSold: (packages.data ?? []).length,
      membershipsSold: (memberships.data ?? []).length,
      dropInsSold: (dropIns.data ?? []).length,
      gmv,
      lastActivity: times[0] ?? null,
    },
  });
});

app.post(`${P}/ops/orgs/:id/status`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const { status } = await c.req.json();
  if (!OPS_ORG_STATUSES.includes(status)) return c.json({ error: "Invalid status." }, 400);
  const { data, error } = await admin().from("organizations").update({ status }).eq("id", id).select().maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: "No such organization" }, 404);
  return c.json({ ok: true, status: data.status });
});

app.post(`${P}/ops/orgs/:id/plan`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const { planId } = await c.req.json();
  if (planId) {
    const { data: plan } = await admin().from("plan_types").select("id").eq("id", planId).maybeSingle();
    if (!plan) return c.json({ error: "No such plan" }, 404);
  }
  const { data, error } = await admin().from("organizations").update({ plan_id: planId || null }).eq("id", id).select().maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: "No such organization" }, 404);
  return c.json({ ok: true, planId: data.plan_id ?? null });
});

app.get(`${P}/ops/team`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const [members, invites] = await Promise.all([
    admin().from("bizqwik_team").select("*").order("created_at"),
    admin().from("bizqwik_team_invitations").select("*").order("created_at"),
  ]);
  return c.json({
    members: (members.data ?? []).map(toBizqwikTeam),
    invites: (invites.data ?? []).map((i: any) => ({ email: i.email, name: i.name, role: i.role })),
  });
});

app.post(`${P}/ops/team/invite`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const { name, email, role } = await c.req.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return c.json({ error: "A valid email is required." }, 400);
  if (!OPS_INVITE_ROLES.includes(role)) return c.json({ error: "Choose a role." }, 400);
  const { data: existing } = await admin().from("bizqwik_team").select("id").eq("email", normalizedEmail).maybeSingle();
  if (existing) return c.json({ error: "That person is already on the Bizqwik team." }, 400);
  const { error } = await admin().from("bizqwik_team_invitations").upsert(
    { email: normalizedEmail, name: String(name ?? "").trim() || null, role, invited_by: team.id },
    { onConflict: "email" },
  );
  if (error) throw error;
  return c.json({ ok: true });
});

app.post(`${P}/ops/team/cancel-invite`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const { email } = await c.req.json();
  await admin().from("bizqwik_team_invitations").delete().eq("email", String(email ?? "").trim().toLowerCase());
  return c.json({ ok: true });
});

app.get(`${P}/ops/plans`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const { data, error } = await admin().from("plan_types").select("*").order("price");
  if (error) throw error;
  return c.json({ plans: (data ?? []).map(toPlanType) });
});

function planFields(body: any) {
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const teamSizeLimit = body.teamSizeLimit === null || body.teamSizeLimit === "" || body.teamSizeLimit === undefined ? null : Number(body.teamSizeLimit);
  const clientSizeLimit = body.clientSizeLimit === null || body.clientSizeLimit === "" || body.clientSizeLimit === undefined ? null : Number(body.clientSizeLimit);
  if (!name) return { error: "Name is required." } as const;
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be zero or more." } as const;
  if (teamSizeLimit !== null && (!Number.isInteger(teamSizeLimit) || teamSizeLimit < 1)) return { error: "Team limit must be a whole number of 1 or more, or blank for unlimited." } as const;
  if (clientSizeLimit !== null && (!Number.isInteger(clientSizeLimit) || clientSizeLimit < 1)) return { error: "Client limit must be a whole number of 1 or more, or blank for unlimited." } as const;
  return { row: { name, price, team_size_limit: teamSizeLimit, client_size_limit: clientSizeLimit } } as const;
}

app.post(`${P}/ops/plans`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const parsed = planFields(await c.req.json());
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { data, error } = await admin().from("plan_types").insert(parsed.row).select().single();
  if (error) throw error;
  return c.json({ plan: toPlanType(data) });
});

app.post(`${P}/ops/plans/update`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const parsed = planFields(body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { data, error } = await admin().from("plan_types").update(parsed.row).eq("id", body.id).select().maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: "No such plan" }, 404);
  return c.json({ plan: toPlanType(data) });
});

app.post(`${P}/ops/plans/delete`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  const { data: inUse } = await admin().from("organizations").select("id").eq("plan_id", id).limit(1);
  if ((inUse?.length ?? 0) > 0) return c.json({ error: "An organization is on this plan — move it to another plan first." }, 400);
  const { error } = await admin().from("plan_types").delete().eq("id", id);
  if (error) throw error;
  return c.json({ ok: true });
});

Deno.serve(app.fetch);

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
// The gym's own calendar day (Cairo), for scan-based attendance: a coach
// scanning at 1am local must land on that local day, not UTC's.
function gymToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
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

// ---- client (member) identity -----------------------------------------
// A member's client row is linked to their auth user via auth_user_id (filled
// at activation). They have no profile; they use the branded client app.
async function clientOf(userId: string) {
  const { data } = await admin().from("clients").select("*").eq("auth_user_id", userId).maybeSingle();
  return data;
}
function toClientAccount(row: any) {
  return { id: row.id, orgId: row.org_id, name: row.name, phone: row.phone ?? null, email: row.email ?? null };
}
async function orgSettingsOf(orgId: string) {
  const { data } = await admin().from("org_settings").select("*").eq("org_id", orgId).maybeSingle();
  return data;
}

async function logActivity(orgId: string, type: string, opts: { actorId?: string | null; clientId?: string | null; amount?: number | null; meta?: any } = {}) {
  await admin().from("activity_log").insert({
    org_id: orgId,
    actor_id: opts.actorId ?? null,
    subject_client_id: opts.clientId ?? null,
    type,
    amount: opts.amount ?? null,
    meta: opts.meta ?? {},
  });
}

// ---- wallet engine (EGP store credit, FIFO credit lots, 12-month expiry) ----
// Each credit row carries `remaining` (unspent) + `expires_at`. Debits consume
// oldest-expiring lots first. Balance = sum(remaining) of live lots; cached in
// wallets.balance. Expiry is swept lazily on any read/debit.
async function sweepWalletExpiry(clientId: string, orgId: string) {
  const nowIso = new Date().toISOString();
  const { data: stale } = await admin().from("wallet_transactions")
    .select("id, remaining")
    .eq("client_id", clientId).eq("org_id", orgId).eq("type", "credit")
    .gt("remaining", 0).lte("expires_at", nowIso);
  for (const lot of stale ?? []) {
    await admin().from("wallet_transactions").update({ remaining: 0 }).eq("id", lot.id);
    await admin().from("wallet_transactions").insert({
      org_id: orgId, client_id: clientId, type: "debit", amount: Number(lot.remaining),
      category: "expiry", description: "Store credit expired",
    });
    await logActivity(orgId, "wallet_expired", { clientId, amount: Number(lot.remaining) });
  }
}
async function walletBalance(clientId: string, orgId: string): Promise<number> {
  await sweepWalletExpiry(clientId, orgId);
  const { data } = await admin().from("wallet_transactions")
    .select("remaining")
    .eq("client_id", clientId).eq("org_id", orgId).eq("type", "credit").gt("remaining", 0);
  const bal = (data ?? []).reduce((s: number, r: any) => s + Number(r.remaining), 0);
  await admin().from("wallets").upsert({ client_id: clientId, org_id: orgId, balance: bal, updated_at: new Date().toISOString() });
  return bal;
}
async function creditWallet(clientId: string, orgId: string, amount: number, category: string, description: string) {
  const settings = await orgSettingsOf(orgId);
  const ttl = settings?.wallet_credit_ttl_months ?? 12;
  const expires = new Date();
  expires.setUTCMonth(expires.getUTCMonth() + ttl);
  await admin().from("wallet_transactions").insert({
    org_id: orgId, client_id: clientId, type: "credit", amount, category, description,
    expires_at: expires.toISOString(), remaining: amount,
  });
  await logActivity(orgId, `wallet_${category}`, { clientId, amount });
  return await walletBalance(clientId, orgId);
}
async function debitWallet(clientId: string, orgId: string, amount: number, category: string, description: string): Promise<{ ok: boolean; balance: number }> {
  const bal = await walletBalance(clientId, orgId);
  if (bal < amount) return { ok: false, balance: bal };
  // Record the debit BEFORE consuming any credit lots. There's no multi-row
  // transaction here, so if this insert fails (e.g. a bad category), it throws
  // before any `remaining` is touched — the balance can never silently drop
  // without a matching ledger row.
  const { error: insErr } = await admin().from("wallet_transactions").insert({
    org_id: orgId, client_id: clientId, type: "debit", amount, category, description,
  });
  if (insErr) throw insErr;
  let need = amount;
  const { data: lots } = await admin().from("wallet_transactions")
    .select("id, remaining")
    .eq("client_id", clientId).eq("org_id", orgId).eq("type", "credit").gt("remaining", 0)
    .order("expires_at", { ascending: true });
  for (const lot of lots ?? []) {
    if (need <= 0) break;
    const take = Math.min(need, Number(lot.remaining));
    await admin().from("wallet_transactions").update({ remaining: Number(lot.remaining) - take }).eq("id", lot.id);
    need -= take;
  }
  return { ok: true, balance: await walletBalance(clientId, orgId) };
}

// Desk-sale payment method. cash/card are external (recorded in activity only);
// "wallet" spends store credit. Default "cash" keeps every existing caller —
// including the current business app, which sends no payMethod — unchanged.
function normPayMethod(v: any): "cash" | "card" | "wallet" {
  return v === "card" ? "card" : v === "wallet" ? "wallet" : "cash";
}

// ---- points engine (v2) ----
// Per-org config: earn rate (points per EGP of cash/card spend; null = points
// off), redeem rate (points per 1 EGP of wallet credit), check-in bonus,
// redemption minimum and expiry. Earned points are lots (remaining +
// expires_at) spent oldest-expiring first; the balance is the ledger's sum.
async function pointsConfig(orgId: string) {
  const s = await orgSettingsOf(orgId);
  return {
    earnPerEgp: (s?.points_earn_per_egp ?? null) as number | null,
    redeemPerEgp: Number(s?.points_redeem_per_egp ?? 500),
    checkin: Number(s?.points_checkin ?? 50),
    minRedeem: Number(s?.points_min_redeem ?? 10000),
    ttlMonths: Number(s?.points_ttl_months ?? 12),
  };
}
async function sweepPointsExpiry(clientId: string, orgId: string) {
  const { data: stale } = await admin().from("points_ledger").select("id, remaining")
    .eq("client_id", clientId).eq("org_id", orgId).gt("remaining", 0).lte("expires_at", new Date().toISOString());
  for (const lot of stale ?? []) {
    await admin().from("points_ledger").update({ remaining: 0 }).eq("id", lot.id);
    await admin().from("points_ledger").insert({ org_id: orgId, client_id: clientId, points: -Number(lot.remaining), reason: "expired" });
  }
}
async function bumpPointsBalance(clientId: string, orgId: string): Promise<number> {
  await sweepPointsExpiry(clientId, orgId);
  const { data } = await admin().from("points_ledger").select("points").eq("client_id", clientId).eq("org_id", orgId);
  const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.points), 0);
  // tier is left to the column default (its check only allows silver/gold/platinum).
  await admin().from("points_balances").upsert({ client_id: clientId, org_id: orgId, total_points: total, updated_at: new Date().toISOString() });
  return total;
}
async function earnPoints(clientId: string, orgId: string, points: number, reason: string, cfg?: Awaited<ReturnType<typeof pointsConfig>>) {
  if (points <= 0) return;
  const c = cfg ?? (await pointsConfig(orgId));
  const expires = addMonths(new Date(), c.ttlMonths).toISOString();
  await admin().from("points_ledger").insert({ org_id: orgId, client_id: clientId, points, reason, remaining: points, expires_at: expires });
  await bumpPointsBalance(clientId, orgId);
  await logActivity(orgId, "points_earned", { clientId, amount: points, meta: { reason } });
}
// Spends points oldest-expiring first. The debit row is written and the
// balance re-checked before any lot is touched, so two concurrent spends
// can't take the same points; returns the new balance, or null if short.
async function spendPoints(clientId: string, orgId: string, points: number, reason: string): Promise<number | null> {
  const { data: debit, error } = await admin().from("points_ledger").insert({ org_id: orgId, client_id: clientId, points: -points, reason }).select().single();
  if (error) throw error;
  const after = await bumpPointsBalance(clientId, orgId);
  if (after < 0) {
    await admin().from("points_ledger").delete().eq("id", debit.id);
    await bumpPointsBalance(clientId, orgId);
    return null;
  }
  let need = points;
  const { data: lots } = await admin().from("points_ledger").select("id, remaining")
    .eq("client_id", clientId).eq("org_id", orgId).gt("remaining", 0).order("expires_at", { ascending: true });
  for (const lot of lots ?? []) {
    if (need <= 0) break;
    const take = Math.min(need, Number(lot.remaining));
    await admin().from("points_ledger").update({ remaining: Number(lot.remaining) - take }).eq("id", lot.id);
    need -= take;
  }
  return after;
}
// Points on a purchase of `egp`. Only new money earns: wallet-paid sales don't.
async function earnPurchasePoints(clientId: string | null | undefined, orgId: string, egp: number, payMethod: string) {
  if (!clientId || !egp || egp <= 0 || payMethod === "wallet") return;
  const cfg = await pointsConfig(orgId);
  if (!cfg.earnPerEgp) return;
  await earnPoints(clientId, orgId, Math.floor(egp * cfg.earnPerEgp), "purchase", cfg);
}
async function earnCheckinPoints(clientId: string, orgId: string) {
  const cfg = await pointsConfig(orgId);
  if (!cfg.earnPerEgp) return;
  await earnPoints(clientId, orgId, cfg.checkin, "checkin", cfg);
}
// A refund takes back the points that money earned (never below zero).
async function clawbackPoints(clientId: string, orgId: string, egp: number) {
  const cfg = await pointsConfig(orgId);
  if (!cfg.earnPerEgp) return;
  const balance = await bumpPointsBalance(clientId, orgId);
  const n = Math.min(Math.floor(egp * cfg.earnPerEgp), balance);
  if (n > 0) await spendPoints(clientId, orgId, n, "refund");
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

// ---- services model: recurring class series + group plans ------------------
// Group training is sold as ONE active group plan per member at a time (an
// all-access membership, one class's monthly, or a class bundle of credits);
// anything not covered by it is a drop-in at the class's price. Private
// training (packages) is separate and can run alongside a group plan.

// Calendar months, rolling from `from` (Jan 31 + 1 month clamps to Feb 28/29).
function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

async function orgTimezone(orgId: string): Promise<string> {
  const { data } = await admin().from("organizations").select("timezone").eq("id", orgId).maybeSingle();
  return data?.timezone || "Africa/Cairo";
}

// Offset (ms) of `tz` from UTC at instant `utcMs`.
function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}
// A gym-local wall-clock date + time ("2026-10-01", "18:30") -> UTC ISO,
// DST-correct (re-checks the offset at the resulting instant).
function localToUtcIso(dateIso: string, time: string, tz: string): string {
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = dateIso.split("-").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, m);
  let utc = naive - tzOffsetMs(naive, tz);
  utc = naive - tzOffsetMs(utc, tz);
  return new Date(utc).toISOString();
}
function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Sessions are generated a rolling 6 weeks ahead and topped up lazily whenever
// a schedule is read — no background job needed, and "runs month to month
// until someone changes it" falls out naturally.
const SERIES_WINDOW_DAYS = 42;
async function generateSeriesSessions(series: any, tz: string) {
  if (series.status !== "active") return;
  const today = todayInTz(tz);
  const until = addDays(today, SERIES_WINDOW_DAYS);
  if (series.generated_until && series.generated_until >= until) return;
  const from = series.generated_until && series.generated_until >= today ? addDays(series.generated_until, 1) : today;
  const time = String(series.start_time).slice(0, 5);
  const weekdays = new Set((series.weekdays ?? []).map(Number));
  const nowMs = Date.now();
  const wanted: string[] = [];
  for (let d = from; d <= until; d = addDays(d, 1)) {
    if (!weekdays.has(new Date(`${d}T00:00:00Z`).getUTCDay())) continue;
    const startsAt = localToUtcIso(d, time, tz);
    if (Date.parse(startsAt) > nowMs) wanted.push(startsAt);
  }
  if (wanted.length > 0) {
    const { data: existing } = await admin().from("classes").select("starts_at").eq("series_id", series.id).gte("starts_at", wanted[0]);
    const have = new Set((existing ?? []).map((r: any) => new Date(r.starts_at).toISOString()));
    const rows = wanted.filter((s) => !have.has(s)).map((s) => ({
      org_id: series.org_id, series_id: series.id, title: series.title, description: series.description ?? null,
      starts_at: s, price_egp: Number(series.drop_in_price), created_by: series.created_by ?? null, status: "active",
    }));
    if (rows.length > 0) {
      const { error } = await admin().from("classes").insert(rows);
      if (error && error.code !== "23505") throw error;
    }
  }
  await admin().from("class_series").update({ generated_until: until }).eq("id", series.id);
}
async function extendOrgSeries(orgId: string) {
  const { data: all } = await admin().from("class_series").select("*").eq("org_id", orgId).eq("status", "active");
  if (!all || all.length === 0) return;
  const tz = await orgTimezone(orgId);
  const until = addDays(todayInTz(tz), SERIES_WINDOW_DAYS);
  for (const s of all) if (!s.generated_until || s.generated_until < until) await generateSeriesSessions(s, tz);
}

// Removes a series' FUTURE sessions nobody holds a seat in (cancelled seats
// don't count). Sessions with live bookings are left for staff to handle.
async function clearFutureUnbookedSessions(seriesId: string) {
  const { data: future } = await admin().from("classes").select("id").eq("series_id", seriesId).gt("starts_at", new Date().toISOString());
  const ids = (future ?? []).map((r: any) => r.id);
  if (ids.length === 0) return { removed: 0, kept: 0 };
  const { data: held } = await admin().from("class_bookings").select("class_id").in("class_id", ids).neq("attendance", "cancelled");
  const heldIds = new Set((held ?? []).map((r: any) => r.class_id));
  const removable = ids.filter((id) => !heldIds.has(id));
  if (removable.length > 0) await admin().from("classes").delete().in("id", removable);
  return { removed: removable.length, kept: heldIds.size };
}

function toClassSeries(row: any) {
  return {
    id: row.id, title: row.title, description: row.description ?? null,
    weekdays: (row.weekdays ?? []).map(Number), startTime: String(row.start_time).slice(0, 5), durationMin: row.duration_min,
    dropInPrice: Number(row.drop_in_price), monthlyPrice: Number(row.monthly_price), status: row.status, createdAt: row.created_at,
  };
}
function toGroupPlanType(row: any) {
  return {
    id: row.id, kind: row.kind, name: row.name, price: Number(row.price), durationMonths: row.duration_months,
    credits: row.credits ?? null, invitationsAllowance: row.invitations_allowance, active: row.active,
  };
}
function toGroupPlan(row: any) {
  return {
    id: row.id, clientId: row.client_id, kind: row.kind, planTypeId: row.plan_type_id ?? null, seriesId: row.series_id ?? null,
    name: row.name, priceAtSale: Number(row.price_at_sale), payMethod: row.pay_method,
    creditsTotal: row.credits_total ?? null, creditsRemaining: row.credits_remaining ?? null,
    invitationsRemaining: row.invitations_remaining, startsAt: row.starts_at, expiresAt: row.expires_at,
    status: row.status, createdAt: row.created_at,
  };
}

// Lazy finish: a plan past its end, or a bundle with no credits left, stops
// being the member's active plan the first time anything looks at it.
async function sweepGroupPlans(clientId: string) {
  const nowIso = new Date().toISOString();
  await admin().from("group_plans").update({ status: "finished" }).eq("client_id", clientId).eq("status", "active").lte("expires_at", nowIso);
  await admin().from("group_plans").update({ status: "finished" }).eq("client_id", clientId).eq("status", "active").eq("kind", "bundle").lte("credits_remaining", 0);
}
async function sweepOrgGroupPlans(orgId: string) {
  const nowIso = new Date().toISOString();
  await admin().from("group_plans").update({ status: "finished" }).eq("org_id", orgId).eq("status", "active").lte("expires_at", nowIso);
  await admin().from("group_plans").update({ status: "finished" }).eq("org_id", orgId).eq("status", "active").eq("kind", "bundle").lte("credits_remaining", 0);
}
async function activeGroupPlan(clientId: string, orgId: string) {
  await sweepGroupPlans(clientId);
  const { data } = await admin().from("group_plans").select("*").eq("client_id", clientId).eq("org_id", orgId).eq("status", "active").maybeSingle();
  return data;
}
function planSummary(plan: any): string {
  const until = String(plan.expires_at).slice(0, 10);
  if (plan.kind === "bundle") return `${plan.name} (${plan.credits_remaining} of ${plan.credits_total} classes left, until ${until})`;
  return `${plan.name} (until ${until})`;
}
// Does this plan pay for this class session?
function planCovers(plan: any, cls: any): boolean {
  if (!plan || plan.status !== "active") return false;
  const at = Date.parse(cls.starts_at);
  if (at < Date.parse(plan.starts_at) || at >= Date.parse(plan.expires_at)) return false;
  if (plan.kind === "membership") return true;
  if (plan.kind === "class_monthly") return !!cls.series_id && cls.series_id === plan.series_id;
  return Number(plan.credits_remaining) > 0;
}

// The one place a group plan is sold — front desk (cash/card/wallet) and the
// member app (wallet only) both land here. `offer` is a catalog item
// (membership/bundle) or a class series (that class's monthly).
async function sellGroupPlan(opts: { orgId: string; client: any; planTypeId?: string | null; seriesId?: string | null; payMethod: "cash" | "card" | "wallet"; actorId: string | null }) {
  const { orgId, client, payMethod, actorId } = opts;
  let row: any;
  if (opts.planTypeId) {
    const { data: t } = await admin().from("group_plan_types").select("*").eq("id", opts.planTypeId).eq("org_id", orgId).maybeSingle();
    if (!t || !t.active) return { error: "That plan isn't on sale.", status: 404 } as const;
    row = {
      kind: t.kind, plan_type_id: t.id, name: t.name, price_at_sale: Number(t.price), months: t.duration_months,
      credits_total: t.kind === "bundle" ? t.credits : null, credits_remaining: t.kind === "bundle" ? t.credits : null,
      invitations_remaining: Number(t.invitations_allowance ?? 0),
    };
  } else if (opts.seriesId) {
    const { data: s } = await admin().from("class_series").select("*").eq("id", opts.seriesId).eq("org_id", orgId).maybeSingle();
    if (!s || s.status !== "active") return { error: "That class isn't running anymore.", status: 404 } as const;
    row = { kind: "class_monthly", series_id: s.id, name: `${s.title} · Monthly`, price_at_sale: Number(s.monthly_price), months: 1, credits_total: null, credits_remaining: null, invitations_remaining: 0 };
  } else {
    return { error: "Choose a plan.", status: 400 } as const;
  }

  const current = await activeGroupPlan(client.id, orgId);
  if (current) {
    return { error: `${client.name} already has an active plan: ${planSummary(current)}. A new one can be bought once it's finished.`, status: 400, code: "active_plan", activePlan: toGroupPlan(current) } as const;
  }

  const start = new Date();
  const { months, ...fields } = row;
  const { data: plan, error } = await admin().from("group_plans").insert({
    org_id: orgId, client_id: client.id, ...fields, pay_method: payMethod,
    starts_at: start.toISOString(), expires_at: addMonths(start, months).toISOString(), status: "active", created_by: actorId,
  }).select().single();
  if (error) {
    // The one-active-plan unique index caught a simultaneous sale.
    if (error.code === "23505") return { error: `${client.name} already has an active plan.`, status: 409, code: "active_plan" } as const;
    throw error;
  }
  if (payMethod === "wallet") {
    const r = await debitWallet(client.id, orgId, Number(plan.price_at_sale), "plan_purchase", `Plan: ${plan.name}`);
    if (!r.ok) {
      await admin().from("group_plans").delete().eq("id", plan.id);
      return { error: "Wallet balance doesn't cover this plan.", status: 400, code: "insufficient_wallet" } as const;
    }
  }
  await earnPurchasePoints(client.id, orgId, Number(plan.price_at_sale), payMethod);
  await logActivity(orgId, "sale_plan", { actorId, clientId: client.id, amount: Number(plan.price_at_sale), meta: { payMethod, kind: plan.kind, name: plan.name, planId: plan.id } });
  return { plan } as const;
}

// Gives back a bundle credit when a plan-covered seat is released. A bundle
// that had been finished only because its last credit was used comes back to
// life — unless it's expired or the member has since bought another plan.
async function returnPlanCredit(booking: any) {
  if (booking.coverage !== "plan" || !booking.group_plan_id) return;
  const { data: plan } = await admin().from("group_plans").select("*").eq("id", booking.group_plan_id).maybeSingle();
  if (!plan || plan.kind !== "bundle") return;
  const credits = Math.min(Number(plan.credits_total), Number(plan.credits_remaining) + 1);
  const patch: any = { credits_remaining: credits };
  if (plan.status === "finished" && Date.parse(plan.expires_at) > Date.now()) {
    const { data: other } = await admin().from("group_plans").select("id").eq("client_id", plan.client_id).eq("status", "active").maybeSingle();
    if (!other) patch.status = "active";
  }
  await admin().from("group_plans").update(patch).eq("id", plan.id);
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
  return { id: row.id, coachId: row.coach_id, month: row.month, date: row.date, createdBy: row.created_by, source: row.source ?? "manual" };
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
// staff invite creates that org's profile; a client invite links the existing
// client row. No match → rejected before any auth user is created.
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
    const { data: clientInvite } = (teamInvite || staffInvite)
      ? { data: null }
      : await admin().from("client_invitations").select("*").eq("email", normalizedEmail).maybeSingle();
    if (!teamInvite && !staffInvite && !clientInvite) return c.json({ error: "You're not part of this organization." }, 403);

    // An invited email can still carry an orphaned login (an auth user with no
    // profile, client or team row — e.g. its client was deleted). Adopt it with
    // the new password rather than failing "already registered"; a login that
    // still backs any identity is never touched.
    let uid: string;
    const { data: existingId } = await admin().rpc("auth_user_id_by_email", { p_email: normalizedEmail });
    if (existingId) {
      const [p, t, cl] = await Promise.all([profileOf(existingId), bizqwikTeamOf(existingId), clientOf(existingId)]);
      if (p || t || cl) return c.json({ error: "This email already has an account — sign in instead." }, 400);
      const { error: uErr } = await admin().auth.admin.updateUserById(existingId, { password, email_confirm: true });
      if (uErr) return c.json({ error: uErr.message }, 400);
      uid = existingId;
    } else {
      const { data: created, error: cErr } = await admin().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (cErr || !created?.user) return c.json({ error: cErr?.message || "Sign up failed" }, 400);
      uid = created.user.id;
    }

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

    if (staffInvite) {
      const { data: profile, error: pErr } = await admin()
        .from("profiles")
        .insert({ id: uid, org_id: staffInvite.org_id, role: staffInvite.role, name: displayName, email, tier_id: staffInvite.tier_id, avatar_url: null })
        .select()
        .single();
      if (pErr) throw pErr;
      await admin().from("staff_invitations").delete().eq("id", staffInvite.id);
      return c.json({ profile: toProfile(profile) });
    }

    // client (member): the client row already exists (created by the front desk
    // at registration) — link it to this new auth user and consume the invite.
    const { data: linked, error: lErr } = await admin()
      .from("clients")
      .update({ auth_user_id: uid })
      .eq("id", clientInvite.client_id)
      .select()
      .single();
    if (lErr) throw lErr;
    await admin().from("client_invitations").delete().eq("id", clientInvite.id);
    return c.json({ client: toClientAccount(linked) });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
});

// ---- me ----------------------------------------------------------------
// Returns whichever identities the caller holds: an org profile (staff),
// bizqwik_team membership (ops), and/or a client account (member). At least one
// must exist.
app.get(`${P}/me`, async (c) => {
  const user = await requireUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const [profile, team, client] = await Promise.all([profileOf(user.id), bizqwikTeamOf(user.id), clientOf(user.id)]);
  if (!profile && !team && !client) return c.json({ error: "No profile" }, 404);
  const tier = profile?.tier_id ? await tierOf(profile.tier_id) : null;
  return c.json({
    profile: profile ? toProfile(profile) : null,
    tier: tier ? toTier(tier) : null,
    bizqwikTeam: team ? toBizqwikTeam(team) : null,
    client: client ? toClientAccount(client) : null,
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
  // Authorship-only references: the records stay, the author link is dropped.
  await admin().from("group_plans").update({ created_by: null }).eq("created_by", id);
  await admin().from("class_series").update({ created_by: null }).eq("created_by", id);
  await admin().from("classes").update({ created_by: null }).eq("created_by", id);

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
  await sweepOrgGroupPlans(me.org_id);
  const { data: plans } = await admin().from("group_plans").select("*").eq("org_id", me.org_id).eq("status", "active");
  const planByClient = new Map((plans ?? []).map((p: any) => [p.client_id, p]));
  const rows = await Promise.all(
    (clients ?? []).map(async (cl) => {
      const [pkg, membership, conditions] = await Promise.all([
        currentPackageForClient(cl.id, me.org_id),
        currentMembershipForClient(cl.id, me.org_id),
        canSeeConditions ? conditionsOf(cl.id) : Promise.resolve(null),
      ]);
      const plan = planByClient.get(cl.id);
      return { ...toClient(cl, conditions, pkg ? toPackageInstance(pkg) : null, membership ? toMembershipInstance(membership) : null), groupPlan: plan ? toGroupPlan(plan) : null };
    }),
  );
  return c.json({ clients: rows });
});

// A client and its first package are created together, atomically — a
// client can never exist without an assigned coach (no more "orphaned"
// clients waiting to be picked up later). If the package leg fails after
// the client row is written, the client row is rolled back rather than
// left behind as a half-created record.
async function sellPackageTo(clientId: string, bundleTypeId: string, coachId: string, me: any, payMethod: "cash" | "card" | "wallet" = "cash") {
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
      pay_method: payMethod,
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
  const payMethod = normPayMethod(body.payMethod);
  // front_desk never writes medical conditions, even if a payload carries them.
  const conditions = me.role === "front_desk" ? null : body.conditions;
  if (!name || !String(name).trim() || !bundleTypeId || !coachId) {
    return c.json({ error: "Name, bundle, and coach are all required to create a client." }, 400);
  }
  if (payMethod === "wallet") return c.json({ error: "A brand-new client has no wallet balance yet — take cash or card." }, 400);
  const limitErr = await planLimitError(me.org_id, "client");
  if (limitErr) return c.json({ error: limitErr }, 400);

  const client = await insertClient(me, { name, age, phone, email });

  if (conditions) {
    await admin().from("client_notes").insert({ client_id: client.id, org_id: me.org_id, conditions });
  }

  const result = await sellPackageTo(client.id, bundleTypeId, coachId, me, payMethod);
  if ("error" in result) {
    await admin().from("client_notes").delete().eq("client_id", client.id);
    await admin().from("clients").delete().eq("id", client.id);
    return c.json({ error: result.error }, result.status);
  }
  await earnPurchasePoints(result.client.id, me.org_id, Number(result.package.price_at_sale), payMethod);
  await logActivity(me.org_id, "sale_package", { actorId: me.id, clientId: result.client.id, amount: Number(result.package.price_at_sale), meta: { payMethod } });
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
  const { data: client } = await admin().from("clients").select("id, auth_user_id").eq("id", id).eq("org_id", me.org_id).maybeSingle();
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
  await admin().from("client_invitations").delete().eq("client_id", id);
  const { error } = await admin().from("clients").delete().eq("id", id);
  if (error) throw error;
  // Remove the member's app login too, so the email isn't left "already
  // registered" — unless that login is also staff or ops.
  if (client.auth_user_id) {
    const [p, t] = await Promise.all([profileOf(client.auth_user_id), bizqwikTeamOf(client.auth_user_id)]);
    if (!p && !t) await admin().auth.admin.deleteUser(client.auth_user_id);
  }
  return c.json({ ok: true });
});

// ---- package instances ----------------------------------------------------
app.post(`${P}/packages`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const { clientId, bundleTypeId, coachId } = body;
  const payMethod = normPayMethod(body.payMethod);
  const result = await sellPackageTo(clientId, bundleTypeId, coachId, me, payMethod);
  if ("error" in result) return c.json({ error: result.error }, result.status);
  const price = Number(result.package.price_at_sale);
  if (payMethod === "wallet") {
    const r = await debitWallet(clientId, me.org_id, price, "desk_sale", "Package purchase");
    if (!r.ok) {
      await admin().from("package_instances").delete().eq("id", result.package.id);
      return c.json({ error: "Wallet balance doesn't cover this package.", code: "insufficient_wallet" }, 400);
    }
  }
  await earnPurchasePoints(clientId, me.org_id, price, payMethod);
  await logActivity(me.org_id, "sale_package", { actorId: me.id, clientId, amount: price, meta: { payMethod } });
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

// ---- check-ins, drop-ins, invitations (front desk) -------------------------
// Check-in eligibility: an active group plan OR an active PT package. (The
// legacy membership_instances still count until that table is retired.)
async function clientPlanStatus(clientId: string, orgId: string) {
  const [membership, pkg, groupPlan] = await Promise.all([
    currentMembershipForClient(clientId, orgId),
    currentPackageForClient(clientId, orgId),
    activeGroupPlan(clientId, orgId),
  ]);
  const activeMembership = membership && membership.status === "active" ? membership : null;
  const activePackage = pkg && pkg.status === "active" ? pkg : null;
  return {
    membership: membership ? toMembershipInstance(membership) : null,
    package: pkg ? toPackageInstance(pkg) : null,
    groupPlan: groupPlan ? toGroupPlan(groupPlan) : null,
    groupPlanRow: groupPlan,
    eligible: !!(activeMembership || activePackage || groupPlan),
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
  return c.json({ client: { ...toClient(client, null, status.package, status.membership), groupPlan: status.groupPlan }, eligible: status.eligible });
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
  if (!status.eligible) return c.json({ error: `${client.name} has no active plan or package.` }, 400);
  const { data, error } = await admin().from("check_ins").insert({ org_id: me.org_id, client_id: clientId, source }).select().single();
  if (error) throw error;
  await earnCheckinPoints(clientId, me.org_id);
  await logActivity(me.org_id, "check_in", { actorId: me.id, clientId });
  return c.json({ checkIn: { id: data.id, clientId: data.client_id, source: data.source, checkedInAt: data.checked_in_at } });
});

app.post(`${P}/drop-ins`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const { classId } = body;
  let clientId: string | null = body.clientId || null;
  const payMethod = normPayMethod(body.payMethod);
  // Every drop-in is recorded against a member: an existing client, or one
  // created right here from `newClient` (name, phone, email).
  const nc = !clientId && body.newClient ? body.newClient : null;
  if (!clientId && !nc) return c.json({ error: "Add the member — every drop-in is recorded against a member." }, 400);
  if (payMethod === "wallet" && !clientId) return c.json({ error: "A brand-new member has no wallet balance yet — take cash or card." }, 400);

  // Two shapes: a seat in a specific class session (price = that class's
  // drop-in price, and the member lands on its roster), or a generic walk-in
  // (free-text "what for" + price, as before).
  let cls: any = null;
  let cat: string;
  let amount: number;
  if (classId) {
    if (!clientId) return c.json({ error: "Pick the member for this class drop-in." }, 400);
    const { data } = await admin().from("classes").select("*").eq("id", classId).eq("org_id", me.org_id).eq("status", "active").maybeSingle();
    if (!data) return c.json({ error: "That class isn't available." }, 404);
    cls = data;
    cat = cls.title;
    amount = Number(cls.price_egp);
  } else {
    cat = String(body.category ?? "").trim();
    amount = Number(body.price);
    if (!cat) return c.json({ error: "Enter what the drop-in is for." }, 400);
    if (!Number.isFinite(amount) || amount < 0) return c.json({ error: "Enter a valid price." }, 400);
  }

  let createdClientId: string | null = null;
  if (nc) {
    const name = String(nc.name ?? "").trim();
    const phone = String(nc.phone ?? "").trim();
    const email = String(nc.email ?? "").trim().toLowerCase();
    if (!name || !phone) return c.json({ error: "Enter the member's name and phone number." }, 400);
    if (!/^\S+@\S+\.\S+$/.test(email)) return c.json({ error: "Enter the member's email — they sign in to the app with it." }, 400);
    const { data: taken } = await admin().from("clients").select("id").eq("org_id", me.org_id).ilike("email", email).limit(1);
    if ((taken?.length ?? 0) > 0) return c.json({ error: "Another client already uses this email — link them instead." }, 400);
    const limitErr = await planLimitError(me.org_id, "client");
    if (limitErr) return c.json({ error: limitErr }, 400);
    const created = await insertClient(me, { name, phone, email });
    createdClientId = created.id;
    clientId = created.id;
    await admin().from("client_invitations").upsert({ org_id: me.org_id, client_id: created.id, email, invited_by: me.id }, { onConflict: "email" });
  }
  // A new member's record is removed again if the sale doesn't go through.
  const undoNewClient = async () => {
    if (!createdClientId) return;
    await admin().from("client_invitations").delete().eq("client_id", createdClientId);
    await admin().from("clients").delete().eq("id", createdClientId);
  };

  if (clientId && !createdClientId) {
    const { data: client } = await admin().from("clients").select("id, name").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
    if (!client) return c.json({ error: "No such client" }, 404);
    if (cls) {
      const { data: seat } = await admin().from("class_bookings").select("id, attendance").eq("class_id", cls.id).eq("client_id", clientId).maybeSingle();
      if (seat && seat.attendance !== "cancelled") return c.json({ error: `${client.name} is already booked into this class.` }, 400);
    }
    // Same flag as the member app: paying for a drop-in while a group plan is
    // still running is allowed, but only once someone has confirmed it.
    const plan = await activeGroupPlan(clientId, me.org_id);
    if (plan && !body.confirmActivePlan) {
      return c.json({
        error: `${client.name} still has ${planSummary(plan)}. Charge a drop-in anyway?`,
        code: "active_plan_confirm",
        activePlan: toGroupPlan(plan),
        coveredByPlan: cls ? planCovers(plan, cls) : false,
      }, 409);
    }
  }

  const { data, error } = await admin()
    .from("drop_ins")
    .insert({ org_id: me.org_id, client_id: clientId, category: cat, price: amount, class_id: cls?.id ?? null, pay_method: payMethod })
    .select()
    .single();
  if (error) {
    await undoNewClient();
    throw error;
  }
  if (payMethod === "wallet") {
    const r = await debitWallet(clientId, me.org_id, amount, "desk_sale", `Drop-in: ${cat}`);
    if (!r.ok) {
      await admin().from("drop_ins").delete().eq("id", data.id);
      return c.json({ error: "Wallet balance doesn't cover this drop-in.", code: "insufficient_wallet" }, 400);
    }
  }
  if (cls) {
    const { error: bErr } = await admin().from("class_bookings").upsert(
      {
        org_id: me.org_id, class_id: cls.id, client_id: clientId, coverage: "drop_in", group_plan_id: null, drop_in_id: data.id,
        pay_method: payMethod === "wallet" ? "wallet" : "desk", pay_status: "paid", attendance: "arrived", price_egp: amount, booked_at: new Date().toISOString(),
      },
      { onConflict: "class_id,client_id" },
    );
    if (bErr) {
      // The seat couldn't be written (e.g. the session was just removed by a
      // schedule edit) — undo the sale so no money is taken without a seat.
      await admin().from("drop_ins").delete().eq("id", data.id);
      await undoNewClient();
      if (payMethod === "wallet") await creditWallet(clientId, me.org_id, amount, "refund", `Refund: ${cat} drop-in not completed`);
      return c.json({ error: "That class session is no longer available — nothing was charged." }, 409);
    }
  }
  await earnPurchasePoints(data.client_id, me.org_id, amount, payMethod);
  await logActivity(me.org_id, "sale_dropin", { actorId: me.id, clientId: data.client_id, amount, meta: { payMethod, classId: cls?.id ?? null, title: cat } });
  return c.json({ dropIn: { id: data.id, clientId: data.client_id, classId: data.class_id ?? null, category: data.category, price: Number(data.price), createdAt: data.created_at }, newClientId: createdClientId });
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
  const membership = await activeGroupPlan(clientId, me.org_id);
  if (!membership) return c.json({ error: `${client.name} doesn't have an active plan.` }, 400);
  if (membership.invitations_remaining <= 0) return c.json({ error: `${client.name} has no invitations left on this plan.` }, 400);

  // Compare-and-set on the old count so two simultaneous invites can't both
  // spend the last one.
  const { data: spent, error: sErr } = await admin()
    .from("group_plans")
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
    await admin().from("group_plans").update({ invitations_remaining: membership.invitations_remaining }).eq("id", membership.id);
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

// PT sessions are deducted only by scanning the member's per-bundle QR
// (shown in their app): proof the member is physically there. Resolves the
// code for the scanning coach, or returns the reason it can't be used.
async function resolvePtScan(me: any, token: string): Promise<{ pkg: any } | { error: string; status: number }> {
  const { data: row } = await admin().from("package_instances").select("*").eq("qr_token", token).eq("org_id", me.org_id).maybeSingle();
  if (!row) return { error: "This PT code isn't valid anymore — ask the member to open their latest code in the app.", status: 404 };
  const pkg = await materializePackage(row);
  if (pkg.status !== "active") return { error: "This PT bundle has finished — it has no sessions left to log.", status: 400 };
  if (pkg.coach_id !== me.id) {
    const { data: coach } = await admin().from("profiles").select("name").eq("id", pkg.coach_id).maybeSingle();
    return { error: `This bundle is with ${coach?.name ?? "another coach"} — only they can log its sessions.`, status: 403 };
  }
  const { data: today } = await admin().from("delivery_logs").select("id").eq("package_instance_id", pkg.id).eq("date", gymToday()).limit(1);
  if ((today?.length ?? 0) > 0) return { error: "Today's session for this bundle is already logged.", status: 400 };
  return { pkg };
}

async function ptScanPreview(pkg: any) {
  const [{ data: client }, { data: bundle }] = await Promise.all([
    admin().from("clients").select("name").eq("id", pkg.client_id).maybeSingle(),
    admin().from("bundle_types").select("name").eq("id", pkg.bundle_type_id).maybeSingle(),
  ]);
  return {
    id: pkg.id,
    clientName: client?.name ?? "Member",
    bundleName: bundle?.name ?? "PT bundle",
    sessionsRemaining: pkg.sessions_remaining,
    sessionsIncluded: pkg.sessions_included,
    expiryDate: String(pkg.expires_at).slice(0, 10),
  };
}

// The FAB's scanner: tells the coach app what was scanned. The coaches'-room
// QR -> "attendance" (the app then shows the session stepper); a member's PT
// code -> "pt" (the app asks to confirm the deduction).
app.post(`${P}/scan`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me || (me.role !== "coach" && me.role !== "head_coach")) return c.json({ error: "Forbidden" }, 403);
  const token = String((await c.req.json().catch(() => ({}))).token ?? "").trim();
  const { data: org } = await admin().from("organizations").select("id, slug, coach_qr_token").eq("id", me.org_id).maybeSingle();
  if (token && token === org?.coach_qr_token) {
    const date = gymToday();
    const blocked = await assertLoggable(me.org_id, me.id, date.slice(0, 7));
    if (blocked) return c.json({ error: blocked }, 400);
    return c.json({ kind: "attendance", date, month: date.slice(0, 7) });
  }
  if (token && (token === org?.slug || token === org?.id)) {
    return c.json({ error: "That's the members' check-in QR — scan the coaches' QR in the coaches' room." }, 400);
  }
  if (token.startsWith("bqpt_")) {
    const r = await resolvePtScan(me, token);
    if ("error" in r) return c.json({ error: r.error }, r.status as any);
    return c.json({ kind: "pt", package: await ptScanPreview(r.pkg) });
  }
  return c.json({ error: "This QR isn't one of your gym's codes." }, 400);
});

app.post(`${P}/packages/deliver`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { qrToken } = await c.req.json();
  if (!qrToken) return c.json({ error: "Scan the member's PT code to log the session.", code: "scan_required" }, 400);
  const r = await resolvePtScan(me, String(qrToken));
  if ("error" in r) return c.json({ error: r.error }, r.status as any);
  const pkg = r.pkg;

  const sessionsRemaining = pkg.sessions_remaining - 1;
  const status = sessionsRemaining <= 0 ? "exhausted" : "active";
  // Compare-and-set so two scans can't both spend the same session.
  const { data: updated, error: uErr } = await admin()
    .from("package_instances")
    .update({ sessions_remaining: sessionsRemaining, status })
    .eq("id", pkg.id)
    .eq("sessions_remaining", pkg.sessions_remaining)
    .select()
    .maybeSingle();
  if (uErr) throw uErr;
  if (!updated) return c.json({ error: "This bundle just changed — scan again." }, 409);

  await admin().from("delivery_logs").insert({ org_id: me.org_id, package_instance_id: pkg.id, date: gymToday(), logged_by: me.id, source: "qr" });

  return c.json({ package: toPackageInstance(updated), preview: await ptScanPreview(updated) });
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
  const body = await c.req.json();
  const { coachId } = body;
  let { month, date } = body;
  if (!canMutateSessions(me, coachId)) return c.json({ error: "Forbidden" }, 403);
  // A coach logs their own attendance only by scanning the coaches'-room QR,
  // and only for today. Heads keep manual control (corrections, any date).
  let source = "manual";
  if (me.role === "coach") {
    const { data: org } = await admin().from("organizations").select("coach_qr_token").eq("id", me.org_id).maybeSingle();
    if (!body.scanToken || body.scanToken !== org?.coach_qr_token) {
      return c.json({ error: "Scan the coaches' QR in the coaches' room to log your attendance.", code: "scan_required" }, 400);
    }
    date = gymToday();
    month = date.slice(0, 7);
    source = "qr";
  } else if (body.scanToken) {
    const { data: org } = await admin().from("organizations").select("coach_qr_token").eq("id", me.org_id).maybeSingle();
    if (body.scanToken === org?.coach_qr_token && coachId === me.id) {
      date = gymToday();
      month = date.slice(0, 7);
      source = "qr";
    }
  }
  const blocked = await assertLoggable(me.org_id, coachId, month);
  if (blocked) return c.json({ error: blocked }, 400);
  const { data, error } = await admin().from("sessions").insert({ org_id: me.org_id, coach_id: coachId, month, date, created_by: me.id, source }).select().single();
  if (error) throw error;
  return c.json({ session: toSession(data) });
});

app.post(`${P}/sessions/edit`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { id, coachId, month, date } = await c.req.json();
  if (!canMutateSessions(me, coachId)) return c.json({ error: "Forbidden" }, 403);
  // A scanned session is pinned to the day it was scanned.
  if (me.role === "coach") return c.json({ error: "Only a head can move a session to another day." }, 403);
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

// GMV = money in, same rule as revenue: wallet-paid sales are left out.
async function gmvByOrg(): Promise<Map<string, number>> {
  const [pkgs, mems, memTypes, drops, plans, bookings] = await Promise.all([
    admin().from("package_instances").select("org_id, price_at_sale").or(NOT_WALLET),
    admin().from("membership_instances").select("org_id, membership_type_id"),
    admin().from("membership_types").select("id, price"),
    admin().from("drop_ins").select("org_id, price").or(NOT_WALLET),
    admin().from("group_plans").select("org_id, price_at_sale").neq("pay_method", "wallet"),
    admin().from("class_bookings").select("org_id, price_egp").eq("coverage", "drop_in").eq("pay_status", "paid").is("drop_in_id", null).neq("pay_method", "wallet"),
  ]);
  const priceOfType = new Map((memTypes.data ?? []).map((t: any) => [t.id, Number(t.price)]));
  const m = new Map<string, number>();
  const add = (org: string, v: number) => m.set(org, (m.get(org) ?? 0) + v);
  for (const p of pkgs.data ?? []) add(p.org_id, Number(p.price_at_sale));
  for (const mi of mems.data ?? []) add(mi.org_id, priceOfType.get(mi.membership_type_id) ?? 0);
  for (const d of drops.data ?? []) add(d.org_id, Number(d.price));
  for (const g of plans.data ?? []) add(g.org_id, Number(g.price_at_sale));
  for (const b of bookings.data ?? []) add(b.org_id, Number(b.price_egp));
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
      coachQrToken: org.coach_qr_token,
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

// Permanently deletes an organization and everything under it (staff, members,
// sales, sessions, wallets, points, branding). The caller must echo the org's
// slug as confirmation. The data goes in one transaction (delete_org); then the
// org's logins are removed unless they still back another identity, and its
// branding images are cleared from storage.
app.post(`${P}/ops/orgs/:id/delete`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const { confirmSlug } = await c.req.json().catch(() => ({}));
  const { data: org } = await admin().from("organizations").select("id, slug, name").eq("id", id).maybeSingle();
  if (!org) return c.json({ error: "No such organization" }, 404);
  if (String(confirmSlug ?? "").trim().toLowerCase() !== org.slug) {
    return c.json({ error: `Type ${org.slug} to confirm.` }, 400);
  }

  const { data: logins, error } = await admin().rpc("delete_org", { p_org: id });
  if (error) throw error;

  let loginsRemoved = 0;
  for (const uid of (logins ?? []) as string[]) {
    const [p, t, cl] = await Promise.all([profileOf(uid), bizqwikTeamOf(uid), clientOf(uid)]);
    if (p || t || cl) continue;
    const { error: dErr } = await admin().auth.admin.deleteUser(uid);
    if (!dErr) loginsRemoved += 1;
  }

  const { data: files } = await admin().storage.from("org-branding").list(id, { limit: 1000 });
  if (files && files.length > 0) await admin().storage.from("org-branding").remove(files.map((f: any) => `${id}/${f.name}`));

  return c.json({ ok: true, name: org.name, loginsRemoved });
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

// ================= Client (member) app + classes + org config =================
function toClassRow(row: any) {
  return { id: row.id, seriesId: row.series_id ?? null, title: row.title, description: row.description ?? null, startsAt: row.starts_at, price: Number(row.price_egp), status: row.status };
}
function toBookingRow(row: any) {
  return {
    id: row.id, classId: row.class_id, payMethod: row.pay_method, payStatus: row.pay_status, attendance: row.attendance, price: Number(row.price_egp), bookedAt: row.booked_at,
    coverage: row.coverage ?? "drop_in", groupPlanId: row.group_plan_id ?? null,
  };
}
async function requireClient(c: any) {
  const user = await requireUser(c);
  if (!user) return null;
  return await clientOf(user.id);
}

// ---- branded onboarding: public pre-auth theming by slug ----
app.get(`${P}/client/branding`, async (c) => {
  const slug = c.req.query("slug") || "";
  const { data: org } = await admin().from("organizations").select("id, name, slug, status").eq("slug", slug).maybeSingle();
  if (!org) return c.json({ error: "Unknown gym" }, 404);
  const { data: b } = await admin().from("org_branding").select("*").eq("org_id", org.id).maybeSingle();
  return c.json({
    org: { id: org.id, name: org.name, slug: org.slug, status: org.status },
    branding: {
      appName: b?.app_name ?? org.name,
      logoUrl: b?.logo_url ?? null,
      iconUrl: b?.icon_url ?? null,
      primaryColor: b?.primary_color ?? null,
      onboardingAssets: b?.onboarding_assets ?? [],
    },
  });
});

app.get(`${P}/client/home`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  await extendOrgSeries(me.org_id);
  const [status, wallet, points, cfg, upcoming] = await Promise.all([
    clientPlanStatus(me.id, me.org_id),
    walletBalance(me.id, me.org_id),
    bumpPointsBalance(me.id, me.org_id),
    pointsConfig(me.org_id),
    admin().from("classes").select("*").eq("org_id", me.org_id).eq("status", "active").gte("starts_at", new Date().toISOString()).order("starts_at").limit(10),
  ]);
  const plan = status.groupPlanRow;
  return c.json({
    name: me.name,
    membership: status.membership,
    package: status.package,
    groupPlan: status.groupPlan,
    eligible: status.eligible,
    wallet,
    points,
    pointsValueEgp: cfg.earnPerEgp ? Math.floor(points / cfg.redeemPerEgp) : 0,
    upcomingClasses: (upcoming.data ?? []).map((r: any) => ({ ...toClassRow(r), coverage: planCovers(plan, r) ? "plan" : "drop_in" })),
  });
});

// The schedule, with what each session would cost THIS member: "plan" when
// their active group plan pays for it, else "drop_in" at the class price.
app.get(`${P}/client/classes`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  await extendOrgSeries(me.org_id);
  const [{ data }, { data: mine }, plan] = await Promise.all([
    admin().from("classes").select("*").eq("org_id", me.org_id).eq("status", "active").gte("starts_at", new Date().toISOString()).order("starts_at"),
    admin().from("class_bookings").select("class_id").eq("client_id", me.id).neq("attendance", "cancelled"),
    activeGroupPlan(me.id, me.org_id),
  ]);
  const booked = new Set((mine ?? []).map((b: any) => b.class_id));
  return c.json({
    activePlan: plan ? toGroupPlan(plan) : null,
    classes: (data ?? []).map((r: any) => ({ ...toClassRow(r), booked: booked.has(r.id), coverage: planCovers(plan, r) ? "plan" : "drop_in" })),
  });
});

// Booking resolver. Covered by the active plan -> a plan seat (a bundle spends
// one credit). Otherwise it's a drop-in at the class price, paid from the
// wallet or at the desk — and if a plan is still running, the member must
// confirm first (409 active_plan_confirm drives the "you still have X" popup).
// `useDropIn: true` forces a drop-in even when the plan would cover it.
app.post(`${P}/client/classes/:id/book`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const classId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const { data: cls } = await admin().from("classes").select("*").eq("id", classId).eq("org_id", me.org_id).eq("status", "active").maybeSingle();
  if (!cls) return c.json({ error: "This class isn't available." }, 404);
  if (Date.parse(cls.starts_at) <= Date.now()) return c.json({ error: "This class has already started." }, 400);
  const { data: existing } = await admin().from("class_bookings").select("id, attendance").eq("class_id", classId).eq("client_id", me.id).maybeSingle();
  if (existing && existing.attendance !== "cancelled") return c.json({ error: "You've already booked this class." }, 400);

  const plan = await activeGroupPlan(me.id, me.org_id);
  if (plan && planCovers(plan, cls) && !body.useDropIn) {
    if (plan.kind === "bundle") {
      // Compare-and-set so two bookings can't both spend the last credit.
      const { data: spent } = await admin().from("group_plans")
        .update({ credits_remaining: Number(plan.credits_remaining) - 1 })
        .eq("id", plan.id).eq("credits_remaining", plan.credits_remaining).select().maybeSingle();
      if (!spent) return c.json({ error: "Your bundle just changed — please try again." }, 409);
    }
    const { data: booking, error } = await admin().from("class_bookings").upsert(
      { org_id: me.org_id, class_id: classId, client_id: me.id, coverage: "plan", group_plan_id: plan.id, drop_in_id: null, pay_method: "plan", pay_status: "paid", attendance: "booked", price_egp: 0, booked_at: new Date().toISOString() },
      { onConflict: "class_id,client_id" },
    ).select().single();
    if (error) {
      await returnPlanCredit({ coverage: "plan", group_plan_id: plan.id });
      throw error;
    }
    await logActivity(me.org_id, "class_booked", { clientId: me.id, amount: 0, meta: { classId, title: cls.title, coverage: "plan", plan: plan.name } });
    return c.json({ booking: toBookingRow(booking) });
  }

  const payMethod = body.payMethod;
  if (payMethod !== "wallet" && payMethod !== "desk") return c.json({ error: "Choose how to pay." }, 400);
  if (plan && !body.confirmActivePlan) {
    return c.json({
      error: `You still have ${planSummary(plan)}. Pay for this class as a drop-in anyway?`,
      code: "active_plan_confirm",
      activePlan: toGroupPlan(plan),
      coveredByPlan: planCovers(plan, cls),
    }, 409);
  }
  const price = Number(cls.price_egp);
  let payStatus = "pending";
  if (payMethod === "wallet") {
    const res = await debitWallet(me.id, me.org_id, price, "class_booking", `Booked ${cls.title}`);
    if (!res.ok) return c.json({ error: "Your wallet balance doesn't cover this class.", code: "insufficient_wallet" }, 400);
    payStatus = "paid";
  }
  const { data: booking, error } = await admin().from("class_bookings").upsert(
    { org_id: me.org_id, class_id: classId, client_id: me.id, coverage: "drop_in", group_plan_id: null, drop_in_id: null, pay_method: payMethod, pay_status: payStatus, attendance: "booked", price_egp: price, booked_at: new Date().toISOString() },
    { onConflict: "class_id,client_id" },
  ).select().single();
  if (error) throw error;
  await logActivity(me.org_id, "class_booked", { clientId: me.id, amount: price, meta: { classId, title: cls.title, payMethod, coverage: "drop_in" } });
  return c.json({ booking: toBookingRow(booking) });
});

// My plans + the shop. Offers: the org's active catalog (memberships and
// bundles) plus a monthly for every running class. `canBuy` is false while a
// plan is active — one plan at a time.
app.get(`${P}/client/plans`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const plan = await activeGroupPlan(me.id, me.org_id);
  const [{ data: history }, { data: types }, { data: series }, wallet] = await Promise.all([
    admin().from("group_plans").select("*").eq("client_id", me.id).order("created_at", { ascending: false }).limit(20),
    admin().from("group_plan_types").select("*").eq("org_id", me.org_id).eq("active", true).order("price"),
    admin().from("class_series").select("*").eq("org_id", me.org_id).eq("status", "active").order("title"),
    walletBalance(me.id, me.org_id),
  ]);
  return c.json({
    activePlan: plan ? toGroupPlan(plan) : null,
    history: (history ?? []).map(toGroupPlan),
    wallet,
    canBuy: !plan,
    offers: [
      ...(types ?? []).map((t: any) => ({ offerType: "plan_type", id: t.id, kind: t.kind, name: t.name, price: Number(t.price), durationMonths: t.duration_months, credits: t.credits ?? null })),
      ...(series ?? []).map((s: any) => ({ offerType: "series", id: s.id, kind: "class_monthly", name: `${s.title} · Monthly`, price: Number(s.monthly_price), durationMonths: 1, credits: null, weekdays: (s.weekdays ?? []).map(Number), startTime: String(s.start_time).slice(0, 5) })),
    ],
  });
});

// Members buy with store credit only; cash/card purchases happen at the desk.
app.post(`${P}/client/plans/buy`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { planTypeId, seriesId } = await c.req.json();
  const result = await sellGroupPlan({ orgId: me.org_id, client: { id: me.id, name: "You" }, planTypeId, seriesId, payMethod: "wallet", actorId: null });
  if ("error" in result) {
    const msg = result.code === "active_plan" ? "You already have an active plan. You can buy a new one once it's finished." : result.error;
    return c.json({ error: msg, code: (result as any).code ?? null, activePlan: (result as any).activePlan ?? null }, result.status);
  }
  return c.json({ plan: toGroupPlan(result.plan), wallet: await walletBalance(me.id, me.org_id) });
});

app.get(`${P}/client/bookings`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { data } = await admin().from("class_bookings").select("*, classes(title, starts_at)").eq("client_id", me.id).order("booked_at", { ascending: false });
  return c.json({ bookings: (data ?? []).map((r: any) => ({ ...toBookingRow(r), classTitle: r.classes?.title ?? null, classStartsAt: r.classes?.starts_at ?? null })) });
});

app.post(`${P}/client/bookings/:id/cancel`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const id = c.req.param("id");
  const { data: booking } = await admin().from("class_bookings").select("*").eq("id", id).eq("client_id", me.id).maybeSingle();
  if (!booking) return c.json({ error: "No such booking" }, 404);
  if (booking.attendance === "cancelled") return c.json({ error: "Already cancelled." }, 400);
  const { data: cls } = await admin().from("classes").select("starts_at").eq("id", booking.class_id).maybeSingle();
  if (cls && Date.parse(cls.starts_at) <= Date.now()) return c.json({ error: "This class has already started, so it can't be cancelled here — please speak to the front desk." }, 400);
  let refunded = 0;
  let creditReturned = false;
  if (booking.coverage === "plan") {
    await returnPlanCredit(booking);
    creditReturned = true;
  } else if (booking.pay_status === "paid" && booking.pay_method === "wallet") {
    await creditWallet(me.id, me.org_id, Number(booking.price_egp), "refund", "Refund: cancelled booking");
    refunded = Number(booking.price_egp);
  }
  await admin().from("class_bookings").update({ attendance: "cancelled", pay_status: booking.pay_status === "paid" ? "refunded" : booking.pay_status }).eq("id", id);
  await logActivity(me.org_id, "class_cancelled", { clientId: me.id, amount: refunded, meta: { bookingId: id, coverage: booking.coverage } });
  return c.json({ ok: true, refundedToWallet: refunded, planCreditReturned: creditReturned });
});

// Member scans the desk QR (which encodes the org slug/id) to check in + earn 1 pt.
app.post(`${P}/client/check-in`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { token } = await c.req.json();
  const { data: org } = await admin().from("organizations").select("id, slug").eq("id", me.org_id).maybeSingle();
  if (!token || (token !== org?.slug && token !== org?.id)) return c.json({ error: "That QR isn't your gym's check-in code." }, 400);
  const status = await clientPlanStatus(me.id, me.org_id);
  if (!status.eligible) return c.json({ error: "No active plan — please see the front desk.", code: "no_plan" }, 400);
  await admin().from("check_ins").insert({ org_id: me.org_id, client_id: me.id, source: "qr" });
  await earnCheckinPoints(me.id, me.org_id);
  await logActivity(me.org_id, "check_in", { clientId: me.id });
  return c.json({ ok: true });
});

// Everything the member has paid us or been credited, however it was paid:
// purchases (plans, PT packages, drop-ins, classes) with their tender, wallet
// credits (refunds, compensation, redeemed points) and expiries, and refunds
// paid out at the desk. `walletDelta` is the change to the wallet balance
// (0 for cash/card), so wallet-paid purchases aren't listed twice.
const WALLET_CREDIT_TITLES: Record<string, string> = {
  refund: "Refund to wallet", compensation: "Compensation", reward: "Points redeemed", topup: "Top-up", cashback: "Cashback",
};
async function clientMoneyHistory(clientId: string) {
  const [plans, pkgs, drops, seats, wallet, deskRefunds] = await Promise.all([
    admin().from("group_plans").select("id, name, price_at_sale, pay_method, created_at").eq("client_id", clientId),
    admin().from("package_instances").select("id, price_at_sale, pay_method, created_at, bundle_types(name)").eq("client_id", clientId),
    admin().from("drop_ins").select("id, category, price, pay_method, created_at").eq("client_id", clientId),
    admin().from("class_bookings").select("id, price_egp, pay_method, pay_status, booked_at, classes(title)").eq("client_id", clientId).eq("coverage", "drop_in").is("drop_in_id", null).in("pay_status", ["paid", "refunded"]),
    admin().from("wallet_transactions").select("id, type, amount, category, description, created_at").eq("client_id", clientId).or("type.eq.credit,category.eq.expiry"),
    admin().from("activity_log").select("id, amount, meta, created_at").eq("subject_client_id", clientId).eq("type", "refund_desk"),
  ]);
  const tender = (m: any) => (m === "cash" || m === "card" || m === "wallet" ? m : "desk");
  const out: any[] = [];
  for (const p of plans.data ?? []) {
    const amt = Number(p.price_at_sale);
    out.push({ id: `plan-${p.id}`, kind: "purchase", title: p.name, amount: amt, method: tender(p.pay_method), walletDelta: p.pay_method === "wallet" ? -amt : 0, at: p.created_at });
  }
  for (const p of pkgs.data ?? []) {
    const amt = Number(p.price_at_sale);
    out.push({ id: `pkg-${p.id}`, kind: "purchase", title: `PT · ${(p as any).bundle_types?.name ?? "Package"}`, amount: amt, method: tender(p.pay_method), walletDelta: p.pay_method === "wallet" ? -amt : 0, at: p.created_at });
  }
  for (const d of drops.data ?? []) {
    const amt = Number(d.price);
    out.push({ id: `drop-${d.id}`, kind: "purchase", title: `Drop-in · ${d.category}`, amount: amt, method: tender(d.pay_method), walletDelta: d.pay_method === "wallet" ? -amt : 0, at: d.created_at });
  }
  for (const b of seats.data ?? []) {
    const amt = Number(b.price_egp);
    out.push({ id: `seat-${b.id}`, kind: "purchase", title: `Class · ${(b as any).classes?.title ?? "Class"}`, amount: amt, method: tender(b.pay_method), walletDelta: b.pay_method === "wallet" ? -amt : 0, at: b.booked_at });
  }
  for (const t of wallet.data ?? []) {
    const amt = Number(t.amount);
    if (t.type === "credit") out.push({ id: `wt-${t.id}`, kind: "credit", title: WALLET_CREDIT_TITLES[t.category] ?? "Wallet credit", detail: t.description ?? null, amount: amt, method: "wallet", walletDelta: amt, at: t.created_at });
    else out.push({ id: `wt-${t.id}`, kind: "expiry", title: "Credit expired", detail: null, amount: amt, method: "wallet", walletDelta: -amt, at: t.created_at });
  }
  for (const r of deskRefunds.data ?? []) {
    out.push({ id: `rf-${r.id}`, kind: "refund", title: "Refund at desk", detail: (r.meta as any)?.note ?? null, amount: Number(r.amount ?? 0), method: "desk", walletDelta: 0, at: r.created_at });
  }
  out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return out.slice(0, 150);
}

// The member's running PT bundles, each with the code their coach scans at
// the session. Finished bundles (used up / expired / replaced by a renewal)
// aren't returned, so their codes disappear from the app.
app.get(`${P}/client/pt`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const { data } = await admin().from("package_instances").select("*").eq("client_id", me.id).eq("org_id", me.org_id).eq("status", "active").order("purchased_at", { ascending: false });
  const live = [];
  for (const row of data ?? []) {
    const pkg = await materializePackage(row);
    if (pkg.status === "active" && pkg.sessions_remaining > 0) live.push(pkg);
  }
  const coachIds = [...new Set(live.map((p) => p.coach_id))];
  const bundleIds = [...new Set(live.map((p) => p.bundle_type_id))];
  const [{ data: coaches }, { data: bundles }, { data: todays }] = await Promise.all([
    coachIds.length ? admin().from("profiles").select("id, name").in("id", coachIds) : Promise.resolve({ data: [] as any[] }),
    bundleIds.length ? admin().from("bundle_types").select("id, name").in("id", bundleIds) : Promise.resolve({ data: [] as any[] }),
    live.length ? admin().from("delivery_logs").select("package_instance_id").in("package_instance_id", live.map((p) => p.id)).eq("date", gymToday()) : Promise.resolve({ data: [] as any[] }),
  ]);
  const coachName = new Map((coaches ?? []).map((x: any) => [x.id, x.name]));
  const bundleName = new Map((bundles ?? []).map((x: any) => [x.id, x.name]));
  const doneToday = new Set((todays ?? []).map((x: any) => x.package_instance_id));
  return c.json({
    bundles: live.map((p) => ({
      id: p.id,
      name: bundleName.get(p.bundle_type_id) ?? "PT bundle",
      coachName: coachName.get(p.coach_id) ?? "Your coach",
      sessionsRemaining: p.sessions_remaining,
      sessionsIncluded: p.sessions_included,
      expiryDate: String(p.expires_at).slice(0, 10),
      qrToken: p.qr_token,
      loggedToday: doneToday.has(p.id),
    })),
  });
});

app.get(`${P}/client/wallet`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const balance = await walletBalance(me.id, me.org_id);
  const { data: tx } = await admin().from("wallet_transactions").select("*").eq("client_id", me.id).order("created_at", { ascending: false }).limit(50);
  return c.json({
    balance,
    transactions: (tx ?? []).map((t: any) => ({ id: t.id, type: t.type, amount: Number(t.amount), category: t.category, description: t.description ?? null, createdAt: t.created_at })),
    activity: await clientMoneyHistory(me.id),
  });
});

app.get(`${P}/client/points`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const [total, cfg] = await Promise.all([bumpPointsBalance(me.id, me.org_id), pointsConfig(me.org_id)]);
  const [{ data: ledger }, { data: next }] = await Promise.all([
    admin().from("points_ledger").select("*").eq("client_id", me.id).order("created_at", { ascending: false }).limit(50),
    admin().from("points_ledger").select("remaining, expires_at").eq("client_id", me.id).gt("remaining", 0).order("expires_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  return c.json({
    enabled: !!cfg.earnPerEgp,
    total,
    // Whole EGP the balance can turn into right now.
    valueEgp: cfg.earnPerEgp ? Math.floor(total / cfg.redeemPerEgp) : 0,
    rate: cfg.redeemPerEgp,
    earnRate: cfg.earnPerEgp,
    checkinPoints: cfg.checkin,
    minRedeem: cfg.minRedeem,
    nextExpiry: next ? { points: Number(next.remaining), at: next.expires_at } : null,
    ledger: (ledger ?? []).map((l: any) => ({ id: l.id, points: l.points, reason: l.reason, createdAt: l.created_at })),
  });
});

// Member turns points into wallet credit at the gym's redeem rate, in whole
// EGP, once past the gym's minimum. Omit `points` to redeem everything.
app.post(`${P}/client/points/redeem`, async (c) => {
  const me = await requireClient(c);
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const cfg = await pointsConfig(me.org_id);
  if (!cfg.earnPerEgp) return c.json({ error: "Points can't be redeemed at your gym yet." }, 400);
  const total = await bumpPointsBalance(me.id, me.org_id);
  if (total < cfg.minRedeem) return c.json({ error: `You need at least ${cfg.minRedeem.toLocaleString("en-US")} points to redeem.` }, 400);
  const requested = body.points === undefined || body.points === null ? total : Number(body.points);
  if (!Number.isInteger(requested) || requested <= 0) return c.json({ error: "Choose how many points to redeem." }, 400);
  if (requested > total) return c.json({ error: "You don't have that many points." }, 400);
  const egpCredited = Math.floor(requested / cfg.redeemPerEgp);
  if (egpCredited < 1) return c.json({ error: `You need at least ${cfg.redeemPerEgp.toLocaleString("en-US")} points to redeem 1 EGP.` }, 400);
  const pointsSpent = egpCredited * cfg.redeemPerEgp;
  const after = await spendPoints(me.id, me.org_id, pointsSpent, "redeem");
  if (after === null) return c.json({ error: "Your points just changed — please try again." }, 409);
  const wallet = await creditWallet(me.id, me.org_id, egpCredited, "reward", `Redeemed ${pointsSpent.toLocaleString("en-US")} points`);
  return c.json({ pointsSpent, egpCredited, points: after, wallet });
});

// ---- classes (dept_head creates; staff view) ----
app.get(`${P}/classes`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  if (me.role === "accountant") return c.json({ error: "Forbidden" }, 403);
  await extendOrgSeries(me.org_id);
  // Recurring series generate lots of sessions, so the list is windowed:
  // the last 14 days (for rosters/attendance) through everything scheduled.
  const since = c.req.query("since") || new Date(Date.now() - 14 * 86400000).toISOString();
  const { data } = await admin().from("classes").select("*").eq("org_id", me.org_id).gte("starts_at", since).order("starts_at", { ascending: true });
  const ids = (data ?? []).map((r: any) => r.id);
  const { data: seats } = ids.length > 0
    ? await admin().from("class_bookings").select("class_id, coverage").in("class_id", ids).neq("attendance", "cancelled")
    : { data: [] as any[] };
  const count = new Map<string, { plan: number; dropIn: number }>();
  for (const s of seats ?? []) {
    const agg = count.get(s.class_id) ?? { plan: 0, dropIn: 0 };
    if (s.coverage === "plan") agg.plan += 1; else agg.dropIn += 1;
    count.set(s.class_id, agg);
  }
  return c.json({
    classes: (data ?? []).map((r: any) => {
      const n = count.get(r.id) ?? { plan: 0, dropIn: 0 };
      return { ...toClassRow(r), bookedCount: n.plan + n.dropIn, planSeats: n.plan, dropInSeats: n.dropIn };
    }),
  });
});
app.post(`${P}/classes`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { title, description, startsAt, price } = await c.req.json();
  if (!String(title ?? "").trim()) return c.json({ error: "Title is required." }, 400);
  if (!startsAt) return c.json({ error: "Pick a date and time." }, 400);
  const p = Number(price);
  if (!Number.isFinite(p) || p < 0) return c.json({ error: "Price must be zero or more." }, 400);
  const { data, error } = await admin().from("classes").insert({ org_id: me.org_id, title: String(title).trim(), description: description ?? null, starts_at: startsAt, price_egp: p, created_by: me.id }).select().single();
  if (error) throw error;
  return c.json({ class: toClassRow(data) });
});
app.post(`${P}/classes/update`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id, title, description, startsAt, price } = await c.req.json();
  const p = Number(price);
  if (!String(title ?? "").trim()) return c.json({ error: "Title is required." }, 400);
  if (!Number.isFinite(p) || p < 0) return c.json({ error: "Price must be zero or more." }, 400);
  const { data, error } = await admin().from("classes").update({ title: String(title).trim(), description: description ?? null, starts_at: startsAt, price_egp: p }).eq("id", id).eq("org_id", me.org_id).select().maybeSingle();
  if (error) throw error;
  if (!data) return c.json({ error: "No such class" }, 404);
  return c.json({ class: toClassRow(data) });
});
app.post(`${P}/classes/cancel`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  const { data: cls } = await admin().from("classes").select("*").eq("id", id).eq("org_id", me.org_id).maybeSingle();
  if (!cls) return c.json({ error: "No such class" }, 404);
  const { data: bookings } = await admin().from("class_bookings").select("*").eq("class_id", id).neq("attendance", "cancelled");
  for (const b of bookings ?? []) {
    if (b.coverage === "plan") {
      await returnPlanCredit(b);
    } else if (b.pay_status === "paid" && b.pay_method === "wallet") {
      await creditWallet(b.client_id, me.org_id, Number(b.price_egp), "refund", `Refund: ${cls.title} cancelled`);
    }
    await admin().from("class_bookings").update({ attendance: "cancelled", pay_status: b.pay_status === "paid" ? "refunded" : b.pay_status }).eq("id", b.id);
  }
  await admin().from("classes").update({ status: "cancelled" }).eq("id", id);
  await logActivity(me.org_id, "class_cancelled_by_staff", { actorId: me.id, meta: { classId: id, title: cls.title } });
  return c.json({ ok: true });
});

// ---- class series (dept_head): recurring classes on chosen weekdays ----
function seriesFields(body: any) {
  const title = String(body.title ?? "").trim();
  const weekdays = Array.isArray(body.weekdays) ? [...new Set(body.weekdays.map(Number))].sort() : [];
  const startTime = String(body.startTime ?? "");
  const durationMin = body.durationMin === undefined || body.durationMin === null || body.durationMin === "" ? 60 : Number(body.durationMin);
  const dropInPrice = Number(body.dropInPrice);
  const monthlyPrice = Number(body.monthlyPrice);
  if (!title) return { error: "Title is required." } as const;
  if (weekdays.length === 0 || weekdays.some((d: any) => !Number.isInteger(d) || d < 0 || d > 6)) return { error: "Pick at least one day of the week." } as const;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) return { error: "Pick a start time." } as const;
  if (!Number.isInteger(durationMin) || durationMin <= 0) return { error: "Duration must be a whole number of minutes." } as const;
  if (!Number.isFinite(dropInPrice) || dropInPrice < 0) return { error: "Drop-in price must be zero or more." } as const;
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) return { error: "Monthly price must be zero or more." } as const;
  return {
    row: { title, description: blankToNull(body.description), weekdays, start_time: startTime, duration_min: durationMin, drop_in_price: dropInPrice, monthly_price: monthlyPrice },
  } as const;
}

app.get(`${P}/class-series`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  await extendOrgSeries(me.org_id);
  const [{ data }, { data: subs }] = await Promise.all([
    admin().from("class_series").select("*").eq("org_id", me.org_id).order("status").order("title"),
    admin().from("group_plans").select("series_id").eq("org_id", me.org_id).eq("status", "active").eq("kind", "class_monthly"),
  ]);
  const subCount = new Map<string, number>();
  for (const s of subs ?? []) subCount.set(s.series_id, (subCount.get(s.series_id) ?? 0) + 1);
  return c.json({ series: (data ?? []).map((r: any) => ({ ...toClassSeries(r), activeMonthlySubscribers: subCount.get(r.id) ?? 0 })) });
});

app.post(`${P}/class-series`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const parsed = seriesFields(await c.req.json());
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { data, error } = await admin().from("class_series").insert({ org_id: me.org_id, ...parsed.row, created_by: me.id }).select().single();
  if (error) throw error;
  await generateSeriesSessions(data, await orgTimezone(me.org_id));
  await logActivity(me.org_id, "class_series_created", { actorId: me.id, meta: { seriesId: data.id, title: data.title } });
  return c.json({ series: toClassSeries(data) });
});

// Editing a series only changes the FUTURE: upcoming sessions nobody has
// booked are regenerated from the new schedule/prices; sessions that already
// have seats keep their time and price (staff can cancel them if needed).
app.post(`${P}/class-series/update`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const parsed = seriesFields(body);
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { data: existing } = await admin().from("class_series").select("*").eq("id", body.id).eq("org_id", me.org_id).maybeSingle();
  if (!existing) return c.json({ error: "No such class" }, 404);
  if (existing.status !== "active") return c.json({ error: "This class has ended — create a new one instead." }, 400);
  const { data, error } = await admin().from("class_series").update({ ...parsed.row, generated_until: null }).eq("id", existing.id).select().single();
  if (error) throw error;
  const cleared = await clearFutureUnbookedSessions(existing.id);
  // Booked future sessions keep their slot/price, but follow the new name.
  await admin().from("classes").update({ title: data.title, description: data.description }).eq("series_id", existing.id).gt("starts_at", new Date().toISOString());
  await generateSeriesSessions(data, await orgTimezone(me.org_id));
  return c.json({ series: toClassSeries(data), keptBookedSessions: cleared.kept });
});

// Ending stops it from recurring: future sessions without seats disappear,
// booked ones stay on the schedule for staff to run or cancel.
app.post(`${P}/class-series/end`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  const { data: existing } = await admin().from("class_series").select("*").eq("id", id).eq("org_id", me.org_id).maybeSingle();
  if (!existing) return c.json({ error: "No such class" }, 404);
  await admin().from("class_series").update({ status: "ended" }).eq("id", id);
  const cleared = await clearFutureUnbookedSessions(id);
  await logActivity(me.org_id, "class_series_ended", { actorId: me.id, meta: { seriesId: id, title: existing.title } });
  return c.json({ ok: true, keptBookedSessions: cleared.kept });
});

// ---- group plan catalog (dept_head): all-access memberships + class bundles ----
function planTypeFields(body: any) {
  const kind = body.kind === "bundle" ? "bundle" : body.kind === "membership" ? "membership" : null;
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const durationMonths = Number(body.durationMonths);
  const credits = kind === "bundle" ? Number(body.credits) : null;
  const invitationsAllowance = Number(body.invitationsAllowance ?? 0);
  if (!kind) return { error: "Choose a membership or a class bundle." } as const;
  if (!name) return { error: "Name is required." } as const;
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be zero or more." } as const;
  if (!Number.isInteger(durationMonths) || durationMonths < 1) return { error: "Duration must be a whole number of months (1 or more)." } as const;
  if (kind === "bundle" && (!Number.isInteger(credits) || (credits as number) < 1)) return { error: "A bundle needs a whole number of classes (1 or more)." } as const;
  if (!Number.isInteger(invitationsAllowance) || invitationsAllowance < 0) return { error: "Invitations must be a whole number, zero or more." } as const;
  return { row: { kind, name, price, duration_months: durationMonths, credits, invitations_allowance: invitationsAllowance } } as const;
}

app.get(`${P}/plan-types`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  let q = admin().from("group_plan_types").select("*").eq("org_id", me.org_id);
  if (me.role === "front_desk") q = q.eq("active", true);
  const { data, error } = await q.order("kind").order("price");
  if (error) throw error;
  return c.json({ planTypes: (data ?? []).map(toGroupPlanType) });
});

app.post(`${P}/plan-types`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const parsed = planTypeFields(await c.req.json());
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const { data, error } = await admin().from("group_plan_types").insert({ org_id: me.org_id, ...parsed.row }).select().single();
  if (error) throw error;
  return c.json({ planType: toGroupPlanType(data) });
});

// Edits apply to future sales only — sold plans keep their snapshot. Kind
// can't change once created (a bundle's credits would be meaningless).
app.post(`${P}/plan-types/update`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const { data: existing } = await admin().from("group_plan_types").select("*").eq("id", body.id).eq("org_id", me.org_id).maybeSingle();
  if (!existing) return c.json({ error: "No such plan" }, 404);
  const parsed = planTypeFields({ ...body, kind: existing.kind });
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const active = body.active === undefined ? existing.active : !!body.active;
  const { data, error } = await admin().from("group_plan_types").update({ ...parsed.row, active }).eq("id", existing.id).select().single();
  if (error) throw error;
  return c.json({ planType: toGroupPlanType(data) });
});

app.post(`${P}/plan-types/delete`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { id } = await c.req.json();
  const { data: sold } = await admin().from("group_plans").select("id").eq("plan_type_id", id).eq("org_id", me.org_id).limit(1);
  if ((sold?.length ?? 0) > 0) return c.json({ error: "This plan has already been sold, so it can't be deleted — take it off sale instead." }, 400);
  const { error } = await admin().from("group_plan_types").delete().eq("id", id).eq("org_id", me.org_id);
  if (error) throw error;
  return c.json({ ok: true });
});

// ---- group plans: desk sales + a member's plan history ----
// Front desk sells to an existing member or creates the member in the same
// step (like memberships/sell did). One active plan per member, enforced in
// sellGroupPlan and by the database.
app.post(`${P}/group-plans/sell`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const { clientId, name, age, phone, email, planTypeId, seriesId } = body;
  const payMethod = normPayMethod(body.payMethod);
  if (payMethod === "wallet" && !clientId) return c.json({ error: "A brand-new client has no wallet balance yet — take cash or card." }, 400);
  if (!planTypeId && !seriesId) return c.json({ error: "Choose a plan." }, 400);

  let client: any;
  let createdNow = false;
  if (clientId) {
    const { data } = await admin().from("clients").select("*").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
    if (!data) return c.json({ error: "No such client" }, 404);
    client = data;
  } else {
    if (!name || !String(name).trim()) return c.json({ error: "Name is required." }, 400);
    const limitErr = await planLimitError(me.org_id, "client");
    if (limitErr) return c.json({ error: limitErr }, 400);
    client = await insertClient(me, { name, age, phone, email });
    createdNow = true;
  }
  let result;
  try {
    result = await sellGroupPlan({ orgId: me.org_id, client, planTypeId, seriesId, payMethod, actorId: me.id });
  } catch (err) {
    if (createdNow) await admin().from("clients").delete().eq("id", client.id);
    throw err;
  }
  if ("error" in result) {
    if (createdNow) await admin().from("clients").delete().eq("id", client.id);
    return c.json({ error: result.error, code: (result as any).code ?? null, activePlan: (result as any).activePlan ?? null }, result.status);
  }
  return c.json({ client: { ...toClient(client, null, null), groupPlan: toGroupPlan(result.plan) }, plan: toGroupPlan(result.plan) });
});

app.get(`${P}/group-plans/client/:id`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const { data: client } = await admin().from("clients").select("id").eq("id", id).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "No such client" }, 404);
  const active = await activeGroupPlan(id, me.org_id);
  const { data } = await admin().from("group_plans").select("*").eq("client_id", id).order("created_at", { ascending: false });
  return c.json({ activePlan: active ? toGroupPlan(active) : null, plans: (data ?? []).map(toGroupPlan) });
});

// ---- revenue (dept_head): the SME founder's money view ----
// Revenue is new money in: sales paid by cash or card, recognised at the
// moment of sale. Sales paid from the wallet are NOT revenue — wallet credit
// comes from refunds (already counted when first sold), compensation and
// points rewards, none of which is new money. Coach payouts are the same
// numbers the payout screens use (group sessions × rate + private cuts).
const REVENUE_TYPE_LABELS: Record<string, string> = {
  pt_bundle: "PT bundles", membership: "Memberships", class_monthly: "Class monthlies", bundle: "Class bundles",
  class_drop_in: "Class drop-ins", walk_in: "Walk-ins", legacy_membership: "Memberships (legacy)",
};
// pay_method is null on sales from before it was recorded (all desk sales).
const NOT_WALLET = "pay_method.is.null,pay_method.neq.wallet";
function monthsBack(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

app.get(`${P}/revenue`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const org = me.org_id;
  const nMonths = Math.min(Math.max(Number(c.req.query("months") ?? "6") || 6, 1), 24);
  const months = monthsBack(nMonths);
  const since = `${months[0]}-01T00:00:00Z`;
  await sweepOrgGroupPlans(org);

  const [pkgs, plans, drops, bookings, legacyMems, legacyTypes, coaches, activePkgs, activePlans, lots] = await Promise.all([
    admin().from("package_instances").select("purchased_at, price_at_sale, coach_id, client_id").eq("org_id", org).gte("purchased_at", since).or(NOT_WALLET),
    admin().from("group_plans").select("created_at, price_at_sale, kind, client_id").eq("org_id", org).gte("created_at", since).neq("pay_method", "wallet"),
    admin().from("drop_ins").select("created_at, price, class_id").eq("org_id", org).gte("created_at", since).or(NOT_WALLET),
    admin().from("class_bookings").select("booked_at, price_egp").eq("org_id", org).eq("coverage", "drop_in").eq("pay_status", "paid").is("drop_in_id", null).neq("pay_method", "wallet").gte("booked_at", since),
    admin().from("membership_instances").select("starts_at, membership_type_id").eq("org_id", org).gte("starts_at", since),
    admin().from("membership_types").select("id, price").eq("org_id", org),
    admin().from("profiles").select("*").eq("org_id", org).in("role", ["coach", "head_coach", "dept_head"]),
    admin().from("package_instances").select("client_id").eq("org_id", org).eq("status", "active").gte("expires_at", `${todayIso()}T00:00:00Z`),
    admin().from("group_plans").select("client_id, kind").eq("org_id", org).eq("status", "active"),
    admin().from("wallet_transactions").select("remaining").eq("org_id", org).eq("type", "credit").gt("remaining", 0).gt("expires_at", new Date().toISOString()),
  ]);

  type Sale = { month: string; amount: number; service: "private_training" | "group"; type: string; coachId?: string };
  const sales: Sale[] = [];
  const mo = (ts: string) => String(ts).slice(0, 7);
  for (const p of pkgs.data ?? []) sales.push({ month: mo(p.purchased_at), amount: Number(p.price_at_sale), service: "private_training", type: "pt_bundle", coachId: p.coach_id });
  for (const g of plans.data ?? []) sales.push({ month: mo(g.created_at), amount: Number(g.price_at_sale), service: "group", type: g.kind });
  for (const d of drops.data ?? []) sales.push({ month: mo(d.created_at), amount: Number(d.price), service: "group", type: d.class_id ? "class_drop_in" : "walk_in" });
  for (const b of bookings.data ?? []) sales.push({ month: mo(b.booked_at), amount: Number(b.price_egp), service: "group", type: "class_drop_in" });
  const legacyPrice = new Map((legacyTypes.data ?? []).map((t: any) => [t.id, Number(t.price)]));
  for (const m of legacyMems.data ?? []) sales.push({ month: mo(m.starts_at), amount: legacyPrice.get(m.membership_type_id) ?? 0, service: "group", type: "legacy_membership" });

  const inRange = new Set(months);
  const kept = sales.filter((s) => inRange.has(s.month));

  // Coach payouts per month, from the same rollup the payout screens use.
  const payoutRows = await Promise.all(months.map((m) => monthRollups(org, coaches.data ?? [], m)));
  const payoutByMonth = new Map(months.map((m, i) => [m, payoutRows[i].reduce((s: number, r: any) => s + r.total, 0)]));
  const payoutByCoach = new Map<string, number>();
  for (const rows of payoutRows) for (const r of rows) payoutByCoach.set(r.coachId, (payoutByCoach.get(r.coachId) ?? 0) + r.total);

  const series = months.map((m) => {
    const revenue = kept.filter((s) => s.month === m).reduce((a, s) => a + s.amount, 0);
    const payouts = payoutByMonth.get(m) ?? 0;
    return { month: m, revenue, payouts, profit: revenue - payouts };
  });
  const sumBy = (key: (s: Sale) => string | undefined) => {
    const out = new Map<string, number>();
    for (const s of kept) {
      const k = key(s);
      if (k) out.set(k, (out.get(k) ?? 0) + s.amount);
    }
    return out;
  };
  const byService = [...sumBy((s) => s.service)].map(([key, amount]) => ({ key, label: key === "group" ? "Group training" : "Private training", amount })).sort((a, b) => b.amount - a.amount);
  const byType = [...sumBy((s) => s.type)].map(([key, amount]) => ({ key, label: REVENUE_TYPE_LABELS[key] ?? key, amount })).sort((a, b) => b.amount - a.amount);
  const coachName = new Map((coaches.data ?? []).map((p: any) => [p.id, p.name]));
  const ptByCoach = sumBy((s) => s.coachId);
  const coachIds = new Set([...ptByCoach.keys(), ...[...payoutByCoach].filter(([, v]) => v > 0).map(([k]) => k)]);
  const byCoach = [...coachIds].map((id) => ({
    coachId: id, name: coachName.get(id) ?? "Former coach", revenue: ptByCoach.get(id) ?? 0, payouts: payoutByCoach.get(id) ?? 0,
  })).sort((a, b) => b.revenue - a.revenue);

  const groupSubs = new Set((activePlans.data ?? []).map((p: any) => p.client_id));
  const ptSubs = new Set((activePkgs.data ?? []).map((p: any) => p.client_id));
  const planKinds: Record<string, number> = { membership: 0, class_monthly: 0, bundle: 0 };
  for (const p of activePlans.data ?? []) planKinds[p.kind] = (planKinds[p.kind] ?? 0) + 1;

  const totalRevenue = series.reduce((a, s) => a + s.revenue, 0);
  const totalPayouts = series.reduce((a, s) => a + s.payouts, 0);
  return c.json({
    months: series,
    totals: { revenue: totalRevenue, payouts: totalPayouts, profit: totalRevenue - totalPayouts },
    byService,
    byType,
    byCoach,
    activeSubscribers: { total: new Set([...groupSubs, ...ptSubs]).size, groupPlans: groupSubs.size, ptPackages: ptSubs.size, byPlanKind: planKinds },
    walletLiability: (lots.data ?? []).reduce((a: number, l: any) => a + Number(l.remaining), 0),
  });
});

// ---- staff: class bookings, attendance, pay-at-desk collection ----
app.get(`${P}/classes/:id/bookings`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const classId = c.req.param("id");
  const { data: cls } = await admin().from("classes").select("id").eq("id", classId).eq("org_id", me.org_id).maybeSingle();
  if (!cls) return c.json({ error: "No such class" }, 404);
  const { data } = await admin().from("class_bookings").select("*, clients(name)").eq("class_id", classId).order("booked_at");
  return c.json({ bookings: (data ?? []).map((r: any) => ({ ...toBookingRow(r), clientName: r.clients?.name ?? null })) });
});
app.post(`${P}/bookings/attendance`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { bookingId, attendance } = await c.req.json();
  if (attendance !== "arrived" && attendance !== "no_show" && attendance !== "booked") return c.json({ error: "Invalid attendance." }, 400);
  const { data: b } = await admin().from("class_bookings").select("*").eq("id", bookingId).eq("org_id", me.org_id).maybeSingle();
  if (!b) return c.json({ error: "No such booking" }, 404);
  if (b.attendance === "cancelled") return c.json({ error: "That booking was cancelled." }, 400);
  await admin().from("class_bookings").update({ attendance }).eq("id", bookingId);
  if (attendance !== "booked") {
    await logActivity(me.org_id, attendance === "arrived" ? "booking_arrived" : "booking_no_show", { actorId: me.id, clientId: b.client_id, meta: { bookingId, classId: b.class_id } });
  }
  return c.json({ ok: true });
});
app.post(`${P}/bookings/collect`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const { bookingId } = body;
  const payMethod = normPayMethod(body.payMethod);
  const { data: b } = await admin().from("class_bookings").select("*").eq("id", bookingId).eq("org_id", me.org_id).maybeSingle();
  if (!b) return c.json({ error: "No such booking" }, 404);
  if (b.pay_status === "paid") return c.json({ error: "Already paid." }, 400);
  if (b.attendance === "cancelled") return c.json({ error: "That booking was cancelled." }, 400);
  const price = Number(b.price_egp);
  if (payMethod === "wallet") {
    const r = await debitWallet(b.client_id, me.org_id, price, "class_booking", "Class payment at desk");
    if (!r.ok) return c.json({ error: "Wallet balance doesn't cover this class.", code: "insufficient_wallet" }, 400);
  }
  // class_bookings.pay_method is constrained to wallet|desk; cash/card collected
  // at the desk are recorded as "desk", with the exact tender in the activity log.
  await admin().from("class_bookings").update({ pay_status: "paid", pay_method: payMethod === "wallet" ? "wallet" : "desk" }).eq("id", bookingId);
  await earnPurchasePoints(b.client_id, me.org_id, price, payMethod);
  await logActivity(me.org_id, "class_collected", { actorId: me.id, clientId: b.client_id, amount: price, meta: { bookingId, payMethod } });
  return c.json({ ok: true });
});

// ---- staff: refunds (to wallet or "at desk") + goodwill compensation ----
app.post(`${P}/clients/refund`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { clientId, amount, destination, note } = await c.req.json();
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return c.json({ error: "Enter a refund amount." }, 400);
  if (destination !== "wallet" && destination !== "desk") return c.json({ error: "Choose where the refund goes." }, 400);
  const { data: client } = await admin().from("clients").select("id").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "No such client" }, 404);
  await clawbackPoints(clientId, me.org_id, amt);
  if (destination === "wallet") {
    const balance = await creditWallet(clientId, me.org_id, amt, "refund", note ? String(note) : "Refund to wallet");
    return c.json({ ok: true, walletBalance: balance });
  }
  // "At desk": the real money (cash / card / Stripe) is handled outside Bizqwik;
  // we only record the equivalent for the log.
  await logActivity(me.org_id, "refund_desk", { actorId: me.id, clientId, amount: amt, meta: { note: note ?? null } });
  return c.json({ ok: true });
});
app.post(`${P}/clients/compensate`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
  const { clientId, amount, note } = await c.req.json();
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) return c.json({ error: "Enter an amount." }, 400);
  const { data: client } = await admin().from("clients").select("id").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "No such client" }, 404);
  const balance = await creditWallet(clientId, me.org_id, amt, "compensation", note ? String(note) : "Compensation credit");
  return c.json({ ok: true, walletBalance: balance });
});

// ---- staff activity feed / logs ----
app.get(`${P}/activity`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const limit = Math.min(Number(c.req.query("limit") ?? "100") || 100, 300);
  const { data } = await admin().from("activity_log").select("*, clients:subject_client_id(name)").eq("org_id", me.org_id).order("created_at", { ascending: false }).limit(limit);
  return c.json({ activity: (data ?? []).map((a: any) => ({ id: a.id, type: a.type, amount: a.amount != null ? Number(a.amount) : null, clientName: a.clients?.name ?? null, meta: a.meta, at: a.created_at })) });
});

// ---- invite a client to the branded app (front desk / dept_head) ----
app.post(`${P}/client-invites`, async (c) => {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
  const { clientId, email } = await c.req.json();
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return c.json({ error: "A valid email is required." }, 400);
  const { data: client } = await admin().from("clients").select("id, auth_user_id").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
  if (!client) return c.json({ error: "No such client" }, 404);
  if (client.auth_user_id) return c.json({ error: "This client already has an app account." }, 400);
  const { error } = await admin().from("client_invitations").upsert(
    { org_id: me.org_id, client_id: clientId, email: normalizedEmail, invited_by: me.id },
    { onConflict: "email" },
  );
  if (error) throw error;
  await admin().from("clients").update({ email: normalizedEmail }).eq("id", clientId);
  return c.json({ ok: true });
});

// ---- ops: per-org branding + settings (bizqwik_team) ----
app.get(`${P}/ops/orgs/:id/config`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const [{ data: b }, { data: s }] = await Promise.all([
    admin().from("org_branding").select("*").eq("org_id", id).maybeSingle(),
    admin().from("org_settings").select("*").eq("org_id", id).maybeSingle(),
  ]);
  return c.json({
    branding: b ? { appName: b.app_name, logoUrl: b.logo_url, iconUrl: b.icon_url, primaryColor: b.primary_color, onboardingAssets: b.onboarding_assets } : null,
    settings: s ? {
      pointsEarnPerEgp: s.points_earn_per_egp ?? null, pointsRedeemPerEgp: s.points_redeem_per_egp, pointsCheckin: s.points_checkin,
      pointsMinRedeem: s.points_min_redeem, pointsTtlMonths: s.points_ttl_months, walletCreditTtlMonths: s.wallet_credit_ttl_months,
    } : null,
  });
});
app.post(`${P}/ops/orgs/:id/branding`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const { appName, logoUrl, iconUrl, primaryColor, onboardingAssets } = await c.req.json();
  const { error } = await admin().from("org_branding").upsert({
    org_id: id, app_name: appName ?? null, logo_url: logoUrl ?? null, icon_url: iconUrl ?? null,
    primary_color: primaryColor ?? null, onboarding_assets: onboardingAssets ?? [], updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return c.json({ ok: true });
});
app.post(`${P}/ops/orgs/:id/settings`, async (c) => {
  const user = await requireUser(c);
  const team = user && (await bizqwikTeamOf(user.id));
  if (!team) return c.json({ error: "Forbidden" }, 403);
  const id = c.req.param("id");
  const body = await c.req.json();
  const int = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
  const earn = int(body.pointsEarnPerEgp);
  const redeem = int(body.pointsRedeemPerEgp) ?? 500;
  const checkin = int(body.pointsCheckin) ?? 0;
  const minRedeem = int(body.pointsMinRedeem) ?? 0;
  const pointsTtl = int(body.pointsTtlMonths) ?? 12;
  const walletTtl = int(body.walletCreditTtlMonths) ?? 12;
  if (earn !== null && (!Number.isInteger(earn) || earn < 1)) return c.json({ error: "Points earned per EGP must be a whole number of 1 or more, or blank for off." }, 400);
  if (!Number.isInteger(redeem) || redeem < 1) return c.json({ error: "Points per 1 EGP of credit must be a whole number of 1 or more." }, 400);
  if (!Number.isInteger(checkin) || checkin < 0) return c.json({ error: "Check-in points must be a whole number, zero or more." }, 400);
  if (!Number.isInteger(minRedeem) || minRedeem < 0) return c.json({ error: "The redemption minimum must be a whole number, zero or more." }, 400);
  if (!Number.isInteger(pointsTtl) || pointsTtl < 1) return c.json({ error: "Points expiry must be at least 1 month." }, 400);
  if (!Number.isInteger(walletTtl) || walletTtl < 1) return c.json({ error: "Wallet credit expiry must be at least 1 month." }, 400);
  const { error } = await admin().from("org_settings").upsert({
    org_id: id, points_earn_per_egp: earn, points_redeem_per_egp: redeem, points_checkin: checkin, points_min_redeem: minRedeem,
    points_ttl_months: pointsTtl, wallet_credit_ttl_months: walletTtl, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return c.json({ ok: true });
});

Deno.serve(app.fetch);

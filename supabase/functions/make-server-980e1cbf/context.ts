
// ---- Supabase admin client --------------------------------------------
// The gateway mints a fresh token for each database request; now and then the
// database's clock is a hair behind and refuses it as "issued at future"
// (PGRST303). That's transient, so wait a moment and send it once more rather
// than failing the whole request (it once signed a member out of the app).
// db / env / admin client (import for local use + re-export for routes)
import {
  fetchRetryingClockSkew,
  SUPABASE_URL,
  SERVICE_ROLE,
  MONEY_RPC,
  adminClient,
  admin,
  background,
  secretCache,
  getSecret,
  vapidReady,
  ensureVapid,
  P,
  currentMonth,
  webpush,
} from "../_shared/db.ts";
import { requireUser } from "../_shared/auth.ts";
import {
  toClient,
  toMembershipInstance,
  toPackageInstance,
} from "../_shared/mappers.ts";
import { staffInOrg as staffInOrgShared } from "../_shared/org.ts";
export {
  fetchRetryingClockSkew,
  SUPABASE_URL,
  SERVICE_ROLE,
  MONEY_RPC,
  adminClient,
  admin,
  background,
  secretCache,
  getSecret,
  vapidReady,
  ensureVapid,
  P,
  currentMonth,
  webpush,
};
export { requireUser };
export { toClient, toMembershipInstance, toPackageInstance };

export const isFutureMonth = (m: string) => m > currentMonth();

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
// The gym's own calendar day (Cairo), for scan-based attendance: a coach
// scanning at 1am local must land on that local day, not UTC's.
export function gymToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Who's calling. The token's signature is checked here against the project's
// published signing keys (fetched once, then cached), so there's no round
// trip to the auth server on every request. The anon key is not a user.
export async function profileOf(userId: string) {
  const { data, error } = await admin().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

// In a solo business the owner (dept_head) does the front desk's work too:
// registering, selling, checking people in. Everywhere else it's front_desk only.
export async function orgInfoOf(orgId: string) {
  const { data } = await admin().from("organizations").select("id, name, slug, mode").eq("id", orgId).maybeSingle();
  return data;
}
export async function orgModeOf(orgId: string): Promise<"solo" | "team"> {
  const { data } = await admin().from("organizations").select("mode").eq("id", orgId).maybeSingle();
  return data?.mode === "solo" ? "solo" : "team";
}
export async function isDeskStaff(me: any): Promise<boolean> {
  if (me?.role === "front_desk") return true;
  if (me?.role !== "dept_head") return false;
  return (await orgModeOf(me.org_id)) === "solo";
}

// Locations (optional). An org with none behaves exactly as before; a plan or
// session with no location is valid everywhere.
// `undefined` = the field wasn't sent (leave it as it is), null = no location.
export async function locationField(orgId: string, v: unknown): Promise<{ id: string | null | undefined } | { error: string }> {
  if (v === undefined) return { id: undefined };
  if (v === null || String(v).trim() === "") return { id: null };
  const { data } = await admin().from("locations").select("id").eq("id", String(v)).eq("org_id", orgId).maybeSingle();
  if (!data) return { error: "That location doesn't exist." };
  return { id: data.id };
}
export async function locationNameOf(id: string | null | undefined): Promise<string> {
  if (!id) return "another location";
  const { data } = await admin().from("locations").select("name").eq("id", id).maybeSingle();
  return data?.name ?? "another location";
}

export async function tierOf(tierId: string) {
  const { data } = await admin().from("tiers").select("*").eq("id", tierId).maybeSingle();
  return data;
}

// A bizqwik_team member's row is keyed on their auth uid (same id), so this
// doubles as "is the caller Bizqwik team." They have no org and run the ops
// dashboard, not any single gym.
export async function bizqwikTeamOf(userId: string) {
  const { data } = await admin().from("bizqwik_team").select("*").eq("id", userId).maybeSingle();
  return data;
}
export function toBizqwikTeam(row: any) {
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}

// A SaaS plan caps an org's team size and client count. Null limit (or no plan
// assigned) = unlimited, so orgs without a plan — like Revolt today — are never
// blocked. Returns a friendly message when the cap is already reached, else null.
export async function planLimitError(orgId: string, kind: "team" | "client"): Promise<string | null> {
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
export async function clientOf(userId: string) {
  const { data } = await admin().from("clients").select("*").eq("auth_user_id", userId).maybeSingle();
  return data;
}
export function toClientAccount(row: any) {
  return { id: row.id, orgId: row.org_id, name: row.name, phone: row.phone ?? null, email: row.email ?? null, homeLocationId: row.home_location_id ?? null };
}
export async function orgSettingsOf(orgId: string) {
  const { data } = await admin().from("org_settings").select("*").eq("org_id", orgId).maybeSingle();
  return data;
}

export async function logActivity(orgId: string, type: string, opts: { actorId?: string | null; clientId?: string | null; amount?: number | null; meta?: any } = {}) {
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
export async function sweepWalletExpiry(clientId: string, orgId: string) {
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
export async function walletBalance(clientId: string, orgId: string): Promise<number> {
  const { data } = await admin().from("wallet_transactions")
    .select("remaining, expires_at")
    .eq("client_id", clientId).eq("org_id", orgId).eq("type", "credit").gt("remaining", 0);
  const now = Date.now();
  // Expired credit is rare: only then take the slower path that writes it off.
  if ((data ?? []).some((r: any) => r.expires_at && Date.parse(r.expires_at) <= now)) {
    await sweepWalletExpiry(clientId, orgId);
    return walletBalance(clientId, orgId);
  }
  const bal = (data ?? []).reduce((s: number, r: any) => s + Number(r.remaining), 0);
  background(admin().from("wallets").upsert({ client_id: clientId, org_id: orgId, balance: bal, updated_at: new Date().toISOString() }));
  return bal;
}
export async function creditWallet(clientId: string, orgId: string, amount: number, category: string, description: string, actorId: string | null = null, meta: any = undefined) {
  if (MONEY_RPC) {
    const { data, error } = await admin().rpc("wallet_credit", {
      p_org_id: orgId,
      p_client_id: clientId,
      p_amount: amount,
      p_category: category,
      p_description: description,
    });
    if (error) throw error;
    await logActivity(orgId, `wallet_${category}`, { clientId, amount, actorId, meta });
    return Number((data as any)?.balance ?? 0);
  }
  const settings = await orgSettingsOf(orgId);
  const ttl = settings?.wallet_credit_ttl_months ?? 12;
  const expires = new Date();
  expires.setUTCMonth(expires.getUTCMonth() + ttl);
  await admin().from("wallet_transactions").insert({
    org_id: orgId, client_id: clientId, type: "credit", amount, category, description,
    expires_at: expires.toISOString(), remaining: amount,
  });
  await logActivity(orgId, `wallet_${category}`, { clientId, amount, actorId, meta });
  return await walletBalance(clientId, orgId);
}
export async function debitWallet(clientId: string, orgId: string, amount: number, category: string, description: string): Promise<{ ok: boolean; balance: number }> {
  if (MONEY_RPC) {
    const { data, error } = await admin().rpc("wallet_debit", {
      p_org_id: orgId,
      p_client_id: clientId,
      p_amount: amount,
      p_category: category,
      p_description: description,
    });
    if (error) throw error;
    return { ok: !!(data as any)?.ok, balance: Number((data as any)?.balance ?? 0) };
  }
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
export function normPayMethod(v: any): "cash" | "card" | "instapay" | "wallet" {
  return v === "card" ? "card" : v === "instapay" ? "instapay" : v === "wallet" ? "wallet" : "cash";
}

// ---- points engine (v2) ----
// Per-org config: earn rate (points per EGP of cash/card spend; null = points
// off), redeem rate (points per 1 EGP of wallet credit), check-in bonus,
// redemption minimum and expiry. Earned points are lots (remaining +
// expires_at) spent oldest-expiring first; the balance is the ledger's sum.
export async function pointsConfig(orgId: string) {
  const s = await orgSettingsOf(orgId);
  return {
    earnPerEgp: (s?.points_earn_per_egp ?? null) as number | null,
    redeemPerEgp: Number(s?.points_redeem_per_egp ?? 500),
    checkin: Number(s?.points_checkin ?? 50),
    minRedeem: Number(s?.points_min_redeem ?? 10000),
    ttlMonths: Number(s?.points_ttl_months ?? 12),
  };
}
export async function sweepPointsExpiry(clientId: string, orgId: string) {
  const { data: stale } = await admin().from("points_ledger").select("id, remaining")
    .eq("client_id", clientId).eq("org_id", orgId).gt("remaining", 0).lte("expires_at", new Date().toISOString());
  for (const lot of stale ?? []) {
    await admin().from("points_ledger").update({ remaining: 0 }).eq("id", lot.id);
    await admin().from("points_ledger").insert({ org_id: orgId, client_id: clientId, points: -Number(lot.remaining), reason: "expired" });
  }
}
export async function bumpPointsBalance(clientId: string, orgId: string): Promise<number> {
  const { data } = await admin().from("points_ledger").select("points, remaining, expires_at").eq("client_id", clientId).eq("org_id", orgId);
  const now = Date.now();
  if ((data ?? []).some((r: any) => Number(r.remaining) > 0 && r.expires_at && Date.parse(r.expires_at) <= now)) {
    await sweepPointsExpiry(clientId, orgId);
    return bumpPointsBalance(clientId, orgId);
  }
  const total = (data ?? []).reduce((s: number, r: any) => s + Number(r.points), 0);
  // tier is left to the column default (its check only allows silver/gold/platinum).
  background(admin().from("points_balances").upsert({ client_id: clientId, org_id: orgId, total_points: total, updated_at: new Date().toISOString() }));
  return total;
}
export async function earnPoints(clientId: string, orgId: string, points: number, reason: string, cfg?: Awaited<ReturnType<typeof pointsConfig>>) {
  if (points <= 0) return;
  if (MONEY_RPC) {
    const { error } = await admin().rpc("points_earn", {
      p_org_id: orgId,
      p_client_id: clientId,
      p_points: points,
      p_reason: reason,
    });
    if (error) throw error;
    await logActivity(orgId, "points_earned", { clientId, amount: points, meta: { reason } });
    return;
  }
  const c = cfg ?? (await pointsConfig(orgId));
  const expires = addMonths(new Date(), c.ttlMonths).toISOString();
  await admin().from("points_ledger").insert({ org_id: orgId, client_id: clientId, points, reason, remaining: points, expires_at: expires });
  await bumpPointsBalance(clientId, orgId);
  await logActivity(orgId, "points_earned", { clientId, amount: points, meta: { reason } });
}
// Spends points oldest-expiring first. The debit row is written and the
// balance re-checked before any lot is touched, so two concurrent spends
// can't take the same points; returns the new balance, or null if short.
export async function spendPoints(clientId: string, orgId: string, points: number, reason: string): Promise<number | null> {
  if (MONEY_RPC) {
    const { data, error } = await admin().rpc("points_spend", {
      p_org_id: orgId,
      p_client_id: clientId,
      p_points: points,
      p_reason: reason,
    });
    if (error) throw error;
    return (data as any)?.ok ? Number((data as any).balance) : null;
  }
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
export async function earnPurchasePoints(clientId: string | null | undefined, orgId: string, egp: number, payMethod: string) {
  if (!clientId || !egp || egp <= 0 || payMethod === "wallet") return;
  const cfg = await pointsConfig(orgId);
  if (!cfg.earnPerEgp) return;
  await earnPoints(clientId, orgId, Math.floor(egp * cfg.earnPerEgp), "purchase", cfg);
}
export async function earnCheckinPoints(clientId: string, orgId: string) {
  const cfg = await pointsConfig(orgId);
  if (!cfg.earnPerEgp) return;
  await earnPoints(clientId, orgId, cfg.checkin, "checkin", cfg);
}
// A refund takes back the points that money earned (never below zero).
export async function clawbackPoints(clientId: string, orgId: string, egp: number) {
  if (MONEY_RPC) {
    const { error } = await admin().rpc("points_clawback", {
      p_org_id: orgId,
      p_client_id: clientId,
      p_egp: egp,
    });
    if (error) throw error;
    return;
  }
  const cfg = await pointsConfig(orgId);
  if (!cfg.earnPerEgp) return;
  const balance = await bumpPointsBalance(clientId, orgId);
  const n = Math.min(Math.floor(egp * cfg.earnPerEgp), balance);
  if (n > 0) await spendPoints(clientId, orgId, n, "refund");
}

// The most a client can be refunded is what they've paid us, less refunds
// already given. Wallet credit from compensation or points isn't money they
// paid, so it doesn't count either way.
export async function refundableFor(clientId: string, orgId: string) {
  const [plans, pkgs, drops, seats, refunds, deskRefunds] = await Promise.all([
    admin().from("group_plans").select("price_at_sale").eq("client_id", clientId).eq("org_id", orgId),
    admin().from("package_instances").select("price_at_sale").eq("client_id", clientId).eq("org_id", orgId),
    admin().from("drop_ins").select("price").eq("client_id", clientId).eq("org_id", orgId),
    admin().from("class_bookings").select("price_egp").eq("client_id", clientId).eq("org_id", orgId).eq("coverage", "drop_in").is("drop_in_id", null).in("pay_status", ["paid", "refunded"]),
    admin().from("wallet_transactions").select("amount").eq("client_id", clientId).eq("org_id", orgId).eq("type", "credit").eq("category", "refund"),
    admin().from("activity_log").select("amount").eq("subject_client_id", clientId).eq("org_id", orgId).eq("type", "refund_desk"),
  ]);
  const sum = (rows: any[] | null, k: string) => (rows ?? []).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const paid = sum(plans.data, "price_at_sale") + sum(pkgs.data, "price_at_sale") + sum(drops.data, "price") + sum(seats.data, "price_egp");
  const refunded = sum(refunds.data, "amount") + sum(deskRefunds.data, "amount");
  return { paid, refunded, refundable: Math.max(0, Math.round((paid - refunded) * 100) / 100) };
}

export const stateOf = (s: any) => (!s ? "logging" : s.paid_at ? "paid" : "settled") as "logging" | "settled" | "paid";

// A package's status is never actively ticked over by a background job (this
// app has none) — expiry is evaluated lazily, right when something reads or
// mutates the package, and the correction is persisted so it sticks.
export async function materializePackage(pkg: any): Promise<any> {
  if (pkg.status === "active" && todayIso() > String(pkg.expires_at).slice(0, 10)) {
    const { data: updated, error } = await admin().from("package_instances").update({ status: "expired" }).eq("id", pkg.id).select().single();
    if (error) throw error;
    return updated;
  }
  return pkg;
}

// Same lazy-expiry approach as packages: a membership past its end date is
// flipped to expired the first time anything reads it.
export async function materializeMembership(m: any): Promise<any> {
  if (m.status === "active" && todayIso() > String(m.expires_at).slice(0, 10)) {
    const { data: updated, error } = await admin().from("membership_instances").update({ status: "expired" }).eq("id", m.id).select().single();
    if (error) throw error;
    return updated;
  }
  return m;
}

export async function currentMembershipForClient(clientId: string, orgId: string) {
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
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** "Mon, Oct 3 · 9:00 PM" in the gym's own time zone, for member messages. */
export async function gymWhen(orgId: string, iso: string): Promise<string> {
  const tz = await orgTimezone(orgId);
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  return `${day} · ${time}`;
}
// A gym's time zone practically never changes; remember it for 10 minutes.
export const tzCache = new Map<string, { tz: string; at: number }>();
export async function orgTimezone(orgId: string): Promise<string> {
  const hit = tzCache.get(orgId);
  if (hit && Date.now() - hit.at < 600_000) return hit.tz;
  const { data } = await admin().from("organizations").select("timezone").eq("id", orgId).maybeSingle();
  const tz = data?.timezone || "Africa/Cairo";
  tzCache.set(orgId, { tz, at: Date.now() });
  return tz;
}

// Offset (ms) of `tz` from UTC at instant `utcMs`.
export function tzOffsetMs(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}
// A gym-local wall-clock date + time ("2026-10-01", "18:30") -> UTC ISO,
// DST-correct (re-checks the offset at the resulting instant).
export function localToUtcIso(dateIso: string, time: string, tz: string): string {
  const [h, m] = time.split(":").map(Number);
  const [y, mo, d] = dateIso.split("-").map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, m);
  let utc = naive - tzOffsetMs(naive, tz);
  utc = naive - tzOffsetMs(utc, tz);
  return new Date(utc).toISOString();
}
export function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Sessions are generated a rolling 6 weeks ahead and topped up lazily whenever
// a schedule is read — no background job needed, and "runs month to month
// until someone changes it" falls out naturally.
export const SERIES_WINDOW_DAYS = 42;
export async function generateSeriesSessions(series: any, tz: string) {
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
      starts_at: s, price_egp: Number(series.drop_in_price), created_by: series.created_by ?? null, status: "active", location_id: series.location_id ?? null,
    }));
    if (rows.length > 0) {
      const { error } = await admin().from("classes").insert(rows);
      if (error && error.code !== "23505") throw error;
    }
  }
  await admin().from("class_series").update({ generated_until: until }).eq("id", series.id);
}
// Topping up is a daily job: once a worker has done it for a gym today it
// skips it (creating or editing a class generates its own sessions).
export const seriesToppedUp = new Map<string, string>();
export async function extendOrgSeries(orgId: string) {
  const tz = await orgTimezone(orgId);
  const today = todayInTz(tz);
  if (seriesToppedUp.get(orgId) === today) return;
  const { data: all } = await admin().from("class_series").select("*").eq("org_id", orgId).eq("status", "active");
  const until = addDays(today, SERIES_WINDOW_DAYS);
  for (const s of all ?? []) if (!s.generated_until || s.generated_until < until) await generateSeriesSessions(s, tz);
  seriesToppedUp.set(orgId, today);
}

// Removes a series' FUTURE sessions nobody holds a seat in (cancelled seats
// don't count). Sessions with live bookings are left for staff to handle.
export async function clearFutureUnbookedSessions(seriesId: string) {
  const { data: future } = await admin().from("classes").select("id").eq("series_id", seriesId).gt("starts_at", new Date().toISOString());
  const ids = (future ?? []).map((r: any) => r.id);
  if (ids.length === 0) return { removed: 0, kept: 0 };
  const { data: held } = await admin().from("class_bookings").select("class_id").in("class_id", ids).neq("attendance", "cancelled");
  const heldIds = new Set((held ?? []).map((r: any) => r.class_id));
  const removable = ids.filter((id) => !heldIds.has(id));
  if (removable.length > 0) await admin().from("classes").delete().in("id", removable);
  return { removed: removable.length, kept: heldIds.size };
}

export function toClassSeries(row: any) {
  return {
    id: row.id, title: row.title, description: row.description ?? null,
    weekdays: (row.weekdays ?? []).map(Number), startTime: String(row.start_time).slice(0, 5), durationMin: row.duration_min,
    dropInPrice: Number(row.drop_in_price), monthlyPrice: Number(row.monthly_price), status: row.status, createdAt: row.created_at,
    imageUrl: row.image_url ?? null, locationId: row.location_id ?? null,
  };
}
export function toGroupPlanType(row: any) {
  return {
    id: row.id, kind: row.kind, name: row.name, price: Number(row.price), durationMonths: row.duration_months,
    credits: row.credits ?? null, invitationsAllowance: row.invitations_allowance, active: row.active, locationId: row.location_id ?? null,
    sharedSeats: row.shared_seats ?? null,
  };
}
export function toGroupPlan(row: any) {
  return {
    id: row.id, clientId: row.client_id, kind: row.kind, planTypeId: row.plan_type_id ?? null, seriesId: row.series_id ?? null,
    name: row.name, priceAtSale: Number(row.price_at_sale), payMethod: row.pay_method,
    creditsTotal: row.credits_total ?? null, creditsRemaining: row.credits_remaining ?? null,
    invitationsRemaining: row.invitations_remaining, startsAt: row.starts_at, expiresAt: row.expires_at,
    status: row.status, createdAt: row.created_at, locationId: row.location_id ?? null,
    shareGroupId: row.share_group_id ?? null,
    // The freeze this plan includes: its length, whether it's running now, and
    // whether the member can still use it.
    freezeDays: Number(row.freeze_days ?? 0),
    frozenUntil: isFrozen(row) ? row.frozen_until : null,
    canFreeze: row.status === "active" && Number(row.freeze_days ?? 0) > 0 && !row.freeze_used && !isFrozen(row) && Date.parse(row.expires_at) > Date.now(),
  };
}
// A frozen plan is paused until `frozen_until`; after that moment it is simply
// active again (nothing has to run for it to restart).
export function isFrozen(row: any): boolean {
  return !!row?.frozen_until && Date.parse(row.frozen_until) > Date.now();
}
// 1-month class plans include a 1-week freeze, 3-month ones 2 weeks.
export function freezeDaysFor(kind: string, months: number, solo: boolean): number {
  if (!solo || kind !== "bundle") return 0;
  return months === 1 ? 7 : months === 3 ? 14 : 0;
}

// Lazy finish: a plan past its end, or a bundle with no credits left, stops
// being the member's active plan the first time anything looks at it.
export async function sweepGroupPlans(clientId: string) {
  const nowIso = new Date().toISOString();
  await Promise.all([
    admin().from("group_plans").update({ status: "finished" }).eq("client_id", clientId).eq("status", "active").lte("expires_at", nowIso),
    admin().from("group_plans").update({ status: "finished" }).eq("client_id", clientId).eq("status", "active").eq("kind", "bundle").lte("credits_remaining", 0),
  ]);
}
export async function sweepOrgGroupPlans(orgId: string) {
  const nowIso = new Date().toISOString();
  await Promise.all([
    admin().from("group_plans").update({ status: "finished" }).eq("org_id", orgId).eq("status", "active").lte("expires_at", nowIso),
    admin().from("group_plans").update({ status: "finished" }).eq("org_id", orgId).eq("status", "active").eq("kind", "bundle").lte("credits_remaining", 0),
  ]);
}
export async function activeGroupPlan(clientId: string, orgId: string) {
  await sweepGroupPlans(clientId);
  const { data } = await admin().from("group_plans").select("*").eq("client_id", clientId).eq("org_id", orgId).eq("status", "active").maybeSingle();
  return data;
}
export function planSummary(plan: any): string {
  const until = String(plan.expires_at).slice(0, 10);
  if (plan.kind === "bundle") return `${plan.name} (${plan.credits_remaining} of ${plan.credits_total} classes left, until ${until})`;
  return `${plan.name} (until ${until})`;
}
// Does this plan pay for this class session?
export function planCovers(plan: any, cls: any): boolean {
  if (!plan || plan.status !== "active" || isFrozen(plan)) return false;
  if (plan.location_id && cls.location_id && plan.location_id !== cls.location_id) return false;
  const at = Date.parse(cls.starts_at);
  if (at < Date.parse(plan.starts_at) || at >= Date.parse(plan.expires_at)) return false;
  if (plan.kind === "membership") return true;
  if (plan.kind === "class_monthly") return !!cls.series_id && cls.series_id === plan.series_id;
  return Number(plan.credits_remaining) > 0;
}

// The one place a group plan is sold — front desk (cash/card/wallet) and the
// member app (wallet only) both land here. `offer` is a catalog item
// (membership/bundle) or a class series (that class's monthly).
export async function sellGroupPlan(opts: { orgId: string; client: any; planTypeId?: string | null; seriesId?: string | null; payMethod: "cash" | "card" | "instapay" | "wallet"; actorId: string | null; shareGroupId?: string | null }) {
  const { orgId, client, payMethod, actorId } = opts;
  const soloOrg = (await orgModeOf(orgId)) === "solo";
  let row: any;
  if (opts.planTypeId) {
    const { data: t } = await admin().from("group_plan_types").select("*").eq("id", opts.planTypeId).eq("org_id", orgId).maybeSingle();
    if (!t || !t.active) return { error: "That plan isn't on sale.", status: 404 } as const;
    // A shared bundle is sold to several clients at once (sellSharedBundle);
    // each gets an even share of the sessions and of the price.
    const seats = Number(t.shared_seats ?? 0);
    if (seats && !opts.shareGroupId) return { error: "This bundle is shared — it's sold to two clients at once.", status: 400 } as const;
    const credits = seats ? Math.floor(t.credits / seats) : t.credits;
    row = {
      kind: t.kind, plan_type_id: t.id, name: t.name, price_at_sale: seats ? Number(t.price) / seats : Number(t.price), months: t.duration_months,
      credits_total: t.kind === "bundle" ? credits : null, credits_remaining: t.kind === "bundle" ? credits : null,
      invitations_remaining: Number(t.invitations_allowance ?? 0), location_id: t.location_id ?? null,
      freeze_days: freezeDaysFor(t.kind, t.duration_months, soloOrg),
    };
  } else if (opts.seriesId) {
    const { data: s } = await admin().from("class_series").select("*").eq("id", opts.seriesId).eq("org_id", orgId).maybeSingle();
    if (!s || s.status !== "active") return { error: "That class isn't running anymore.", status: 404 } as const;
    row = { kind: "class_monthly", series_id: s.id, name: `${s.title} · Monthly`, price_at_sale: Number(s.monthly_price), months: 1, credits_total: null, credits_remaining: null, invitations_remaining: 0, location_id: s.location_id ?? null };
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
    org_id: orgId, client_id: client.id, ...fields, pay_method: payMethod, share_group_id: opts.shareGroupId ?? null,
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
  if (plan.location_id) await admin().from("clients").update({ home_location_id: plan.location_id }).eq("id", client.id).is("home_location_id", null);
  await earnPurchasePoints(client.id, orgId, Number(plan.price_at_sale), payMethod);
  await logActivity(orgId, "sale_plan", { actorId, clientId: client.id, amount: Number(plan.price_at_sale), meta: { payMethod, kind: plan.kind, name: plan.name, planId: plan.id, locationId: plan.location_id ?? null } });
  // A solo gym takes no bookings: they just turn up.
  const goNow = (await orgModeOf(orgId)) === "solo" ? "Just turn up to a class." : "Book a class to get going.";
  await notifyClient(orgId, client.id, "plan_started", {
    title: `${plan.name} is active`,
    body: plan.kind === "bundle" ? `${plan.credits_total} sessions to use by ${String(plan.expires_at).slice(0, 10)}. ${goNow}` : `Valid until ${String(plan.expires_at).slice(0, 10)}. ${goNow}`,
    push: !!actorId,
  });
  return { plan } as const;
}

// Gives back a bundle credit when a plan-covered seat that already used one is
// released (only bookings from before check-in deduction, or checked-in ones). A bundle
// that had been finished only because its last credit was used comes back to
// life — unless it's expired or the member has since bought another plan.
export async function returnPlanCredit(booking: any) {
  if (booking.coverage !== "plan" || !booking.group_plan_id || !booking.credit_spent) return;
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
export function toProfile(row: any) {
  return { id: row.id, email: row.email, name: row.name, role: row.role, tierId: row.tier_id, avatarUrl: row.avatar_url ?? null };
}
export function toTier(row: any) {
  return { id: row.id, name: row.name, rate: Number(row.hourly_rate), privateCutPct: Number(row.private_cut_pct) };
}
export function toBundleType(row: any) {
  return { id: row.id, name: row.name, price: Number(row.price), sessionsIncluded: row.sessions_included, expiryDays: row.expiry_days, locationId: row.location_id ?? null, active: row.active !== false };
}
export function toSession(row: any) {
  return { id: row.id, coachId: row.coach_id, month: row.month, date: row.date, createdBy: row.created_by, source: row.source ?? "manual", createdAt: row.created_at ?? null };
}
export function toInvite(row: any) {
  return { email: row.email, role: row.role, tierId: row.tier_id, invitedBy: row.invited_by };
}
export function toSettlement(row: any) {
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
export function homePathForRole(role: string): string {
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
export async function sendPushToProfile(
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

/** Tells a member something: always an entry in their in-app notifications
 * (the bell), and — when `push` — a web push to every device they enabled it
 * on. Things the member just did themselves are in-app only; things the gym
 * did (a class cancelled, a refund, a coach logging PT) and reminders push.
 * `ref` makes it idempotent (a second call with the same type+ref is a no-op),
 * which scheduled reminders rely on. Never throws. */
// A solo gym takes no bookings, so class messages go to everyone who could
// turn up: members with a running plan or PT package whose home location is
// the class's (members with no location hear about every class).
export async function classAudience(orgId: string, locationId: string | null): Promise<string[]> {
  const [plans, pkgs] = await Promise.all([
    // A member whose plan is frozen isn't training right now, so no class reminders.
    admin().from("group_plans").select("client_id").eq("org_id", orgId).eq("status", "active").or(`frozen_until.is.null,frozen_until.lte.${new Date().toISOString()}`),
    admin().from("package_instances").select("client_id").eq("org_id", orgId).eq("status", "active"),
  ]);
  const ids = [...new Set([...(plans.data ?? []), ...(pkgs.data ?? [])].map((r: any) => r.client_id))];
  if (ids.length === 0) return [];
  const { data: clients } = await admin().from("clients").select("id, home_location_id").in("id", ids);
  return (clients ?? []).filter((c: any) => !locationId || !c.home_location_id || c.home_location_id === locationId).map((c: any) => c.id);
}

export async function notifyClient(
  orgId: string,
  clientId: string,
  type: string,
  msg: { title: string; body: string; url?: string; ref?: string; push?: boolean },
) {
  try {
    const row = { org_id: orgId, client_id: clientId, type, title: msg.title, body: msg.body, url: msg.url ?? null, ref: msg.ref ?? null };
    if (msg.ref) {
      const { data, error } = await admin().from("client_notifications")
        .upsert(row, { onConflict: "client_id,type,ref", ignoreDuplicates: true }).select("id");
      if (error) throw error;
      if (!data?.length) return; // already told them
    } else {
      const { error } = await admin().from("client_notifications").insert(row);
      if (error) throw error;
    }
    if (!msg.push) return;
    await ensureVapid();
    const { data: subs } = await admin().from("client_push_subscriptions").select("*").eq("client_id", clientId);
    await Promise.all((subs ?? []).map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? "/" }),
          { TTL: 86400 },
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) await admin().from("client_push_subscriptions").delete().eq("id", sub.id);
        else console.log("client push failed", clientId, err?.statusCode, err?.message);
      }
    }));
  } catch (err) {
    console.log("notifyClient error", clientId, type, (err as Error).message);
  }
}


// ---- helpers originally between routes ----


// ---- signup (anon) -----------------------------------------------------
// Locked to invited emails only, and multi-org aware: the org (or Bizqwik-team
// membership) a new account joins is decided entirely by which invite their
// email matches — never by "the one org that exists," since there can now be
// many. A Bizqwik-team invite creates a team member (no org, no profile); a
// staff invite creates that org's profile; a client invite links the existing
// client row. No match → rejected before any auth user is created.

// ---- me ----------------------------------------------------------------
// Returns whichever identities the caller holds: an org profile (staff),
// bizqwik_team membership (ops), and/or a client account (member). At least one
// must exist.

// Self-service: change your own display name and/or avatar photo.
// Email/role/tier are deliberately NOT editable here — those stay
// dept_head-only, managed through /profiles/assign-tier and the
// invite/remove flows. The actual image file is uploaded straight to
// Supabase Storage from the client (its own bucket policies enforce that a
// user can only write under their own uid) — this endpoint only ever
// receives the resulting public URL string, never file bytes.

// ---- push notifications --------------------------------------------------
// Public: the frontend needs the VAPID public key to call
// pushManager.subscribe(). It's not secret — only the private key is.



// Admin-only diagnostic: sends a real push to a specific profile's
// subscriptions right now, gated by the cron shared secret instead of a
// user JWT so it can be checked directly (e.g. from SQL/pg_net) without
// needing that person's password. Kept for backend debugging — there's no
// UI hook for this, deliberately.

// Fired by a pg_cron job (Sun–Thu, 9:00 PM Cairo time) via pg_net — never by
// a user, so it's gated by a shared secret instead of a user JWT. Reminds
// everyone who can log a session (coach, head_coach, dept_head) and hasn't
// logged one yet today, per organization. Accountant and front_desk are
// deliberately excluded — the app gives those roles no way to log a session
// at all, so the reminder would just be noise for them.

// ---- tiers -------------------------------------------------------------




// ---- bundle types --------------------------------------------------------
// ---- locations (staff read; dept_head names them) ----
export function toLocation(row: any) {
  return { id: row.id, name: row.name };
}
// Staff set (or clear) a member's home location.





// ---- coach picker ----------------------------------------------------------
// Names only — for roles that assign clients to coaches but must not see
// payout data (front_desk can't use /month, which carries earnings).

// ---- invites -------------------------------------------------------------



// ---- profiles ----------------------------------------------------------



// ---- clients (private training) -----------------------------------------
export async function conditionsOf(clientId: string): Promise<string | null> {
  const { data } = await admin().from("client_notes").select("conditions").eq("client_id", clientId).maybeSingle();
  return data?.conditions ?? null;
}

export async function currentPackageForClient(clientId: string, orgId: string) {
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


// A client and its first package are created together, atomically — a
// client can never exist without an assigned coach (no more "orphaned"
// clients waiting to be picked up later). If the package leg fails after
// the client row is written, the client row is rolled back rather than
// left behind as a half-created record.
export async function sellPackageTo(clientId: string, bundleTypeId: string, coachId: string, me: any, payMethod: "cash" | "card" | "instapay" | "wallet" = "cash") {
  const { data: client, error: cErr } = await admin().from("clients").select("*").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
  if (cErr) throw cErr;
  if (!client) return { error: "No such client", status: 404 } as const;

  const current = await currentPackageForClient(clientId, me.org_id);
  if (current && current.status === "active") {
    return { error: "This client already has an active package.", status: 400 } as const;
  }

  const { data: bundleType } = await admin().from("bundle_types").select("*").eq("id", bundleTypeId).eq("org_id", me.org_id).maybeSingle();
  if (!bundleType) return { error: "No such bundle type", status: 404 } as const;
  if (bundleType.active === false) return { error: "That package isn't on sale anymore.", status: 400 } as const;
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
      location_id: bundleType.location_id ?? null,
    })
    .select()
    .single();
  if (pErr) throw pErr;
  if (bundleType.location_id) await admin().from("clients").update({ home_location_id: bundleType.location_id }).eq("id", clientId).is("home_location_id", null);

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

export const blankToNull = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

export async function insertClient(me: any, fields: { name: string; age?: unknown; phone?: unknown; email?: unknown }) {
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




// ---- package instances ----------------------------------------------------

// Assign (or change) a client's coach outside of a package sale — e.g. a
// membership-only client. Blocked while a package is running: the coach on
// an active package is locked in until it's finished.

// ---- check-ins, drop-ins, invitations (front desk) -------------------------
// Check-in eligibility: an active group plan OR an active PT package. (The
// legacy membership_instances still count until that table is retired.)
export async function clientPlanStatus(clientId: string, orgId: string) {
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

// ---- check-in: the one place a visit is recorded -------------------------
// Everyone with an active plan or PT package can check in (and earns points).
// A class bundle is used on arrival: every visit takes one session off it (a
// member can train twice a day), and it marks today's reserved class (if any)
// attended; a class already paid for at booking isn't charged again on that
// first scan. Memberships and class monthlies are time-based, and PT is logged
// by the coach's scan, so those deduct nothing here.
// Only an accidental double scan is blocked: a second scan within a minute of
// the last one. Check-in points are earned once per gym day.
export async function dayBoundsUtc(orgId: string) {
  const tz = await orgTimezone(orgId);
  const today = todayInTz(tz);
  return { start: localToUtcIso(today, "00:00", tz), end: localToUtcIso(addDays(today, 1), "00:00", tz) };
}

export const CHECKIN_BUFFER_MS = 60_000;

export type CheckInResult =
  | { ok: true; checkIn: any; deducted: boolean; plan: { name: string; kind: string; creditsRemaining: number | null; creditsTotal: number | null } | null }
  | { ok: false; error: string; status: number; code?: string; plan?: any };

export async function recordCheckIn(orgId: string, clientId: string, clientName: string, source: "qr" | "manual", actorId: string | null, self: boolean, locationId: string | null = null): Promise<CheckInResult> {
  const status = await clientPlanStatus(clientId, orgId);
  // Checking in at a known location with a plan sold for a different one (and
  // no PT package or legacy membership to fall back on): turn it away.
  const gp = status.groupPlanRow;
  if (locationId && gp?.location_id && gp.location_id !== locationId && !(status.package && status.package.status === "active") && !(status.membership && status.membership.status === "active")) {
    const where = await locationNameOf(gp.location_id);
    return { ok: false, status: 400, code: "wrong_location", plan: toGroupPlan(gp), error: self ? `Your ${gp.name} is for ${where}.` : `${clientName}'s ${gp.name} is for ${where}, not this location.` };
  }
  // A frozen plan is paused: it can't be used to check in until the freeze ends
  // (a PT package or legacy membership still can).
  if (gp && isFrozen(gp) && !(status.package && status.package.status === "active") && !(status.membership && status.membership.status === "active")) {
    const until = String(gp.frozen_until).slice(0, 10);
    return { ok: false, status: 400, code: "plan_frozen", plan: toGroupPlan(gp), error: self ? `Your ${gp.name} is frozen until ${until}. It restarts by itself.` : `${clientName}'s ${gp.name} is frozen until ${until}.` };
  }
  if (!status.eligible) {
    // A bundle that ran out gets its own, clearer answer.
    const { data: last } = await admin().from("group_plans").select("*").eq("client_id", clientId).eq("org_id", orgId)
      .eq("kind", "bundle").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Number(last.credits_remaining) <= 0 && Date.parse(last.expires_at) > Date.now()) {
      return {
        ok: false, status: 400, code: "no_sessions", plan: toGroupPlan(last),
        error: self
          ? `You've used all ${last.credits_total} sessions of ${last.name}. Renew at the front desk to keep training.`
          : `${clientName} has used all ${last.credits_total} sessions of ${last.name}. Renew their bundle to check them in.`,
      };
    }
    return { ok: false, status: 400, code: "no_plan", error: self ? "No active plan — please see the front desk." : `${clientName} has no active plan or package.` };
  }

  // An accidental double scan: the same member again within a minute.
  const { data: lastIn } = await admin().from("check_ins").select("checked_in_at").eq("client_id", clientId).eq("org_id", orgId)
    .order("checked_in_at", { ascending: false }).limit(1).maybeSingle();
  if (lastIn && Date.now() - Date.parse(lastIn.checked_in_at) < CHECKIN_BUFFER_MS) {
    return { ok: false, status: 409, code: "just_checked_in", error: self ? "You're already checked in — enjoy your session!" : `${clientName} was just checked in.` };
  }
  const { start, end } = await dayBoundsUtc(orgId);
  const { data: anyToday } = await admin().from("check_ins").select("id").eq("client_id", clientId).eq("org_id", orgId)
    .gte("checked_in_at", start).lt("checked_in_at", end).limit(1);
  const firstToday = !(anyToday?.length);

  let plan = status.groupPlanRow;
  if (plan && isFrozen(plan)) plan = null; // frozen: don't take a session from it
  let deductFrom: string | null = null;
  if (plan && plan.kind === "bundle") {
    const { data: todays } = await admin().from("class_bookings").select("id, credit_spent, attendance, classes!inner(starts_at)")
      .eq("client_id", clientId).eq("group_plan_id", plan.id).eq("coverage", "plan").neq("attendance", "cancelled")
      .gte("classes.starts_at", start).lt("classes.starts_at", end);
    // A class booked before this rule already used its session at booking, so
    // the day's first scan doesn't charge it again; a later visit does.
    const prepaid = firstToday && (todays ?? []).some((b: any) => b.credit_spent);
    if (!prepaid) {
      if (Number(plan.credits_remaining) <= 0) {
        return { ok: false, status: 400, code: "no_sessions", plan: toGroupPlan(plan), error: self ? `You've used all sessions of ${plan.name}. Renew at the front desk to keep training.` : `${clientName} has no sessions left on ${plan.name}.` };
      }
      // Compare-and-set so two check-ins can't both take the last session.
      const { data: spent } = await admin().from("group_plans").update({ credits_remaining: Number(plan.credits_remaining) - 1 })
        .eq("id", plan.id).eq("credits_remaining", plan.credits_remaining).select().maybeSingle();
      if (!spent) return { ok: false, status: 409, error: "That bundle just changed — please scan again." };
      plan = spent;
      deductFrom = plan.id;
      const reserved = (todays ?? []).find((b: any) => !b.credit_spent);
      if (reserved) await admin().from("class_bookings").update({ credit_spent: true, attendance: "arrived" }).eq("id", reserved.id);
    }
    // Any other class reserved today on this bundle counts as attended too.
    const openIds = (todays ?? []).filter((b: any) => b.attendance === "booked").map((b: any) => b.id);
    if (openIds.length) await admin().from("class_bookings").update({ attendance: "arrived" }).in("id", openIds);
  }

  const { data: checkIn, error } = await admin().from("check_ins").insert({ org_id: orgId, client_id: clientId, source, group_plan_id: deductFrom }).select().single();
  if (error) {
    if (deductFrom) await admin().from("group_plans").update({ credits_remaining: Number(plan.credits_remaining) + 1 }).eq("id", deductFrom);
    throw error;
  }
  if (firstToday) await earnCheckinPoints(clientId, orgId);
  await logActivity(orgId, "check_in", { actorId, clientId, meta: deductFrom ? { bundle: plan.name, sessionsLeft: Number(plan.credits_remaining) } : {} });
  const left = deductFrom ? Number(plan.credits_remaining) : null;
  await notifyClient(orgId, clientId, "checked_in", {
    title: "Checked in 💪",
    body: left !== null ? `1 session used · ${left} of ${plan.credits_total} left on ${plan.name}.` : "Enjoy your session!",
    push: !self,
  });
  if (left !== null && left <= 2) {
    await notifyClient(orgId, clientId, left === 0 ? "bundle_finished" : "bundle_low", {
      title: left === 0 ? `${plan.name} is used up` : `${left} session${left === 1 ? "" : "s"} left`,
      body: left === 0 ? "That was your last session. Renew at the front desk or in the app to keep training." : `You're almost through ${plan.name}. Renew soon so you don't miss a class.`,
      ref: `${plan.id}:${left}`,
      push: true,
    });
  }
  return {
    ok: true,
    checkIn,
    deducted: !!deductFrom,
    plan: plan ? { name: plan.name, kind: plan.kind, creditsRemaining: plan.credits_remaining ?? null, creditsTotal: plan.credits_total ?? null } : null,
  };
}





// Home-screen numbers from real rows. There's no check-out tracking, so
// "active now" means checked in (or dropped in) within the last 2 hours.

// PT sessions are deducted only by scanning the member's per-bundle QR
// (shown in their app): proof the member is physically there. Resolves the
// code for the scanning coach, or returns the reason it can't be used.
export async function resolvePtScan(me: any, token: string): Promise<{ pkg: any } | { error: string; status: number }> {
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

export async function ptScanPreview(pkg: any) {
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


// Coach payout drill-down (accountant/dept_head/head_coach): every private
// package this coach sold in a given month, enriched with the client and
// bundle names — client conditions are deliberately NOT included here, this
// is a finance view, not a client-management one.

// ---- month rollups -----------------------------------------------------
// What's been paid so far against each settlement (id -> amount).
export async function paidBySettlementMap(settlementIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (settlementIds.length === 0) return out;
  const rows = await fetchAllRows((a, b) => admin().from("settlement_payments").select("settlement_id, amount").in("settlement_id", settlementIds).order("id").range(a, b));
  for (const r of rows) out.set(r.settlement_id, (out.get(r.settlement_id) ?? 0) + Number(r.amount));
  return out;
}
// One coach-per-row payout summary for a month, from the month's already-read data.
export function buildRollupRows(profiles: any[], tierById: Map<any, any>, settlementByCoach: Map<any, any>, sessionCountByCoach: Map<string, number>, privateByCoach: Map<string, { total: number; count: number }>, paidBySettlement: Map<string, number> = new Map()) {
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
    // Part payments: what's been paid out of a settled month, and what's left.
    const total = groupTotal + privateTotal;
    const paidAmount = settlement ? (state === "paid" ? total : Math.min(total, paidBySettlement.get(settlement.id) ?? 0)) : 0;
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
      total,
      state,
      settledAt: settlement?.settled_at ?? null,
      paidAt: settlement?.paid_at ?? null,
      paidAmount,
      remaining: state === "settled" ? Math.max(0, total - paidAmount) : 0,
    };
  });
}

export async function monthRollups(orgId: string, profiles: any[], month: string) {
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

  return buildRollupRows(profiles, tierById, settlementByCoach, sessionCountByCoach, privateByCoach, await paidBySettlementMap(settlements.map((x) => x.id)));
}

// Every row of a query, one 1000-row page at a time (the API's page cap).
export async function fetchAllRows(page: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// The same numbers as monthRollups, for many months at once: what doesn't
// depend on the month (tiers, packages sold) is read once, and the rest
// (settlements, session counts) in one query each, instead of four queries a month.
export async function monthRollupsMany(orgId: string, profiles: any[], months: string[]): Promise<Map<string, any[]>> {
  const [tiersRes, settlements, countsRes, packages] = await Promise.all([
    admin().from("tiers").select("*").eq("org_id", orgId),
    fetchAllRows((a, b) => admin().from("settlements").select("*").eq("org_id", orgId).in("month", months).order("id").range(a, b)),
    admin().rpc("revenue_session_counts", { p_org: orgId, p_months: months }),
    fetchAllRows((a, b) => admin().from("package_instances").select("id, coach_id, coach_cut_at_sale, purchased_at").eq("org_id", orgId).gte("purchased_at", `${months[0]}-01T00:00:00Z`).order("id").range(a, b)),
  ]);
  if (countsRes.error) throw countsRes.error;
  const tierById = new Map((tiersRes.data ?? []).map((t: any) => [t.id, t]));
  const paidBySettlement = await paidBySettlementMap(settlements.map((x: any) => x.id));
  const out = new Map<string, any[]>();
  for (const month of months) {
    const settlementByCoach = new Map(settlements.filter((s: any) => s.month === month).map((s: any) => [s.coach_id, s]));
    const sessionCountByCoach = new Map<string, number>();
    for (const r of countsRes.data ?? []) if (r.month === month) sessionCountByCoach.set(r.coach_id, Number(r.n));
    const privateByCoach = new Map<string, { total: number; count: number }>();
    for (const p of packages) {
      if (String(p.purchased_at).slice(0, 7) !== month) continue;
      const agg = privateByCoach.get(p.coach_id) ?? { total: 0, count: 0 };
      agg.total += Number(p.coach_cut_at_sale);
      agg.count += 1;
      privateByCoach.set(p.coach_id, agg);
    }
    out.set(month, buildRollupRows(profiles, tierById, settlementByCoach, sessionCountByCoach, privateByCoach, paidBySettlement));
  }
  return out;
}


// ---- sessions ----------------------------------------------------------
export function canMutateSessions(me: any, coachId: string) {
  if (me.role === "coach") return me.id === coachId;
  return me.role === "dept_head" || me.role === "head_coach";
}

// The staff member a session or settlement is for must work at the caller's
// gym. Profile ids come from the request, so never trust them on their own.
export async function staffInMyOrg(me: any, profileId: string) {
  if (!me?.org_id || !profileId) return null;
  return await staffInOrgShared(me.org_id, profileId);
}


export async function assertLoggable(orgId: string, coachId: string, month: string) {
  if (isFutureMonth(month)) return "This month hasn't started yet.";
  const { data: settlement } = await admin().from("settlements").select("*").eq("org_id", orgId).eq("coach_id", coachId).eq("month", month).maybeSingle();
  const state = stateOf(settlement);
  if (state !== "logging") return "This month is settled — reopen it to make changes.";
  return null;
}




// ---- state transitions -------------------------------------------------


export const PAY_METHODS = ["cash", "bank", "instapay"];
export function toSettlementPayment(row: any) {
  return { id: row.id, amount: Number(row.amount), paidOn: row.paid_on, method: row.method, note: row.note ?? null, paidBy: row.paid_by ?? null, createdAt: row.created_at };
}

// Records a payment against a settled month — any amount up to what's left.
// The month turns "paid" when the payments add up to its total. Omitting the
// amount pays whatever is left (the old one-tap "mark paid").

// The payments made against one coach's month, oldest first. The coach sees
// their own; heads and the accountant see anyone's in their org.

// ================= Bizqwik ops dashboard (bizqwik_team only) =================
// A bizqwik_team member runs Bizqwik itself, across every org. These endpoints
// are gated on team membership (not any org role) and use the service-role
// client to read/write across orgs, the same shape as `is_bizqwik_team()`'s
// RLS bypass but enforced here in code.
export const OPS_ORG_STATUSES = ["trial", "active", "paused"];
export const OPS_INVITE_ROLES = ["ops_manager", "teammate"];

export function toPlanType(row: any) {
  return { id: row.id, name: row.name, price: Number(row.price), teamSizeLimit: row.team_size_limit, clientSizeLimit: row.client_size_limit };
}

// GMV = money in, same rule as revenue: wallet-paid sales are left out.
export async function gmvByOrg(): Promise<Map<string, number>> {
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

export async function countsByOrg(): Promise<{ staff: Map<string, number>; clients: Map<string, number> }> {
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



// Each gym's member app lives at <slug>.bizqwik.co. The wildcard DNS already
// routes every subdomain to the client-app project, but Vercel only issues an
// https certificate for a subdomain added to the project by name (the DNS is at
// GoDaddy, so no wildcard certificate) — and without https phones block the
// camera. So creating/deleting an org adds/removes its domain automatically.
// Needs the vercel_token secret in Vault; without it this is skipped and reported.
export const VERCEL_PROJECT = "prj_sngf4uowChULYDqvI5syTZzGLqYq";
export const VERCEL_TEAM = "team_fGNC6nYrJCurPXH9plLSJWIZ";
export const gymDomain = (slug: string) => `${slug}.bizqwik.co`;

export async function vercelDomain(method: "POST" | "DELETE", slug: string): Promise<{ ok: boolean; reason?: string }> {
  const token = await getSecret("vercel_token").catch(() => null);
  if (!token) return { ok: false, reason: "the Vercel token isn't set up yet" };
  const url =
    method === "POST"
      ? `https://api.vercel.com/v10/projects/${VERCEL_PROJECT}/domains?teamId=${VERCEL_TEAM}`
      : `https://api.vercel.com/v9/projects/${VERCEL_PROJECT}/domains/${gymDomain(slug)}?teamId=${VERCEL_TEAM}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify({ name: gymDomain(slug) }) : undefined,
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    const code = body?.error?.code;
    // Already there (adding) or already gone (removing) is the outcome we want.
    if (method === "POST" && (code === "domain_already_in_use" || code === "domain_already_exists")) return { ok: true };
    if (method === "DELETE" && res.status === 404) return { ok: true };
    return { ok: false, reason: body?.error?.message ?? `Vercel ${res.status}` };
  } catch (e) {
    return { ok: false, reason: String(e) };
  }
}






// Permanently deletes an organization and everything under it (staff, members,
// sales, sessions, wallets, points, branding). The caller must echo the org's
// slug as confirmation. The data goes in one transaction (delete_org); then the
// org's logins are removed unless they still back another identity, and its
// branding images are cleared from storage.





export function planFields(body: any) {
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




// ================= Client (member) app + classes + org config =================
export function toClassRow(row: any) {
  // A series session shows its series' photo unless it has its own.
  const imageUrl = row.image_url ?? row.class_series?.image_url ?? null;
  return { id: row.id, seriesId: row.series_id ?? null, title: row.title, description: row.description ?? null, startsAt: row.starts_at, price: Number(row.price_egp), status: row.status, imageUrl, locationId: row.location_id ?? null };
}
export function toBookingRow(row: any) {
  return {
    id: row.id, classId: row.class_id, payMethod: row.pay_method, payStatus: row.pay_status, attendance: row.attendance, price: Number(row.price_egp), bookedAt: row.booked_at,
    coverage: row.coverage ?? "drop_in", groupPlanId: row.group_plan_id ?? null, creditSpent: !!row.credit_spent,
  };
}
// Who's going to each upcoming class, for the member app's avatar stack:
// a head count and up to 4 sets of initials — never names. The member
// themselves shows first as "You".
export function initialsOf(name: string): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "•";
}
export async function classGoing(orgId: string, meId: string) {
  // A solo gym has no bookings — "going" is its members' RSVPs.
  const solo = (await orgModeOf(orgId)) === "solo";
  const { data } = solo
    ? await admin().from("class_rsvps").select("class_id, client_id, clients(name), classes!inner(starts_at)")
        .eq("org_id", orgId).gte("classes.starts_at", new Date().toISOString()).order("created_at")
    : await admin().from("class_bookings").select("class_id, client_id, clients(name), classes!inner(starts_at)")
        .eq("org_id", orgId).neq("attendance", "cancelled").gte("classes.starts_at", new Date().toISOString()).order("booked_at");
  const out = new Map<string, { count: number; initials: string[] }>();
  for (const b of data ?? []) {
    const g = out.get(b.class_id) ?? { count: 0, initials: [] };
    g.count += 1;
    if (b.client_id === meId) g.initials.unshift("You");
    else if (g.initials.length < 4) g.initials.push(initialsOf((b as any).clients?.name ?? ""));
    out.set(b.class_id, g);
  }
  for (const g of out.values()) g.initials = g.initials.slice(0, 4);
  return out;
}
export const NO_ONE = { count: 0, initials: [] as string[] };

// The classes a member is in: bookings, or (solo gyms) RSVPs.
export async function myClassIds(me: any): Promise<Set<string>> {
  if ((await orgModeOf(me.org_id)) === "solo") {
    const { data } = await admin().from("class_rsvps").select("class_id").eq("client_id", me.id);
    return new Set((data ?? []).map((r: any) => r.class_id));
  }
  const { data } = await admin().from("class_bookings").select("class_id").eq("client_id", me.id).neq("attendance", "cancelled");
  return new Set((data ?? []).map((b: any) => b.class_id));
}


export async function requireClient(c: any) {
  const user = await requireUser(c);
  if (!user) return null;
  return await clientOf(user.id);
}

// ---- branded onboarding: public pre-auth theming by slug ----


// A member with a home location sees that location's sessions and plans (plus
// anything not tied to a location). Without one, they see everything.
export const atMemberLocation = (q: any, me: any) => (me.home_location_id ? q.or(`location_id.is.null,location_id.eq.${me.home_location_id}`) : q);


// The schedule, with what each session would cost THIS member: "plan" when
// their active group plan pays for it, else "drop_in" at the class price.

// Solo gyms: "I'm coming" / "can't make it". No payment, no plan, no limit — it
// only tells the owner how many to expect.

// Booking resolver. Covered by the active plan -> a plan seat (a bundle's
// session is used later, at check-in). Otherwise it's a drop-in at the class price, paid from the
// wallet or at the desk — and if a plan is still running, the member must
// confirm first (409 active_plan_confirm drives the "you still have X" popup).
// `useDropIn: true` forces a drop-in even when the plan would cover it.

// My plans + the shop. Offers: the org's active catalog (memberships and
// bundles) plus a monthly for every running class. `canBuy` is false while a
// plan is active — one plan at a time.

// Freeze the member's plan (solo gyms): once per plan, for the length it includes
// (1 week on a 1-month plan, 2 weeks on a 3-month one). The plan's end date moves
// out by the same time, and it restarts by itself when the freeze is over.

// Members buy with store credit only; cash/card purchases happen at the desk.

// ---- paying by InstaPay transfer (solo gyms) ----
// The member pays in the InstaPay app, uploads the receipt screenshot here, and
// the owner approves it. Nothing is granted until she does. The screenshot
// lives in a private bucket and is only ever shown to her via a short-lived link.
export const PROOF_BUCKET = "payment-proofs";
export const NO_EXPIRY = 3650;

export function toPaymentRequest(r: any) {
  return {
    id: r.id, offerType: r.offer_type, name: r.name, price: Number(r.price), status: r.status,
    note: r.note ?? null, locationId: r.location_id ?? null, createdAt: r.created_at, reviewedAt: r.reviewed_at ?? null,
  };
}

// The owner of a solo business (she is also its desk).
export async function soloOwnerOf(c: any) {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (me?.role !== "dept_head" || (await orgModeOf(me.org_id)) !== "solo") return null;
  return me;
}




// Owner: what's waiting (newest first) with a short-lived link to each screenshot.





// Member scans the desk QR (which encodes the org slug/id) to check in: earns
// points, and uses one session of a class bundle (see recordCheckIn).

// Everything the member has paid us or been credited, however it was paid:
// purchases (plans, PT packages, drop-ins, classes) with their tender, wallet
// credits (refunds, compensation, redeemed points) and expiries, and refunds
// paid out at the desk. `walletDelta` is the change to the wallet balance
// (0 for cash/card), so wallet-paid purchases aren't listed twice.
export const WALLET_CREDIT_TITLES: Record<string, string> = {
  refund: "Refund to wallet", compensation: "Compensation", reward: "Points redeemed", topup: "Top-up", cashback: "Cashback",
};
export async function clientMoneyHistory(clientId: string) {
  const [plans, pkgs, drops, seats, wallet, deskRefunds] = await Promise.all([
    admin().from("group_plans").select("id, name, price_at_sale, pay_method, created_at").eq("client_id", clientId),
    admin().from("package_instances").select("id, price_at_sale, pay_method, created_at, bundle_types(name)").eq("client_id", clientId),
    admin().from("drop_ins").select("id, category, price, pay_method, created_at").eq("client_id", clientId),
    admin().from("class_bookings").select("id, price_egp, pay_method, pay_status, booked_at, classes(title)").eq("client_id", clientId).eq("coverage", "drop_in").is("drop_in_id", null).in("pay_status", ["paid", "refunded"]),
    admin().from("wallet_transactions").select("id, type, amount, category, description, created_at").eq("client_id", clientId).or("type.eq.credit,category.eq.expiry"),
    admin().from("activity_log").select("id, amount, meta, created_at").eq("subject_client_id", clientId).eq("type", "refund_desk"),
  ]);
  const tender = (m: any) => (m === "cash" || m === "card" || m === "instapay" || m === "wallet" ? m : "desk");
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



// Member turns points into wallet credit at the gym's redeem rate, in whole
// EGP, once past the gym's minimum. Omit `points` to redeem everything.

// ---- member notifications (the bell) + web push ----
export function toClientNotification(n: any) {
  return { id: n.id, type: n.type, title: n.title, body: n.body, url: n.url ?? null, read: !!n.read_at, createdAt: n.created_at };
}
// Marks some (`ids`) or all of the member's notifications read.

// Fired every 15 minutes by pg_cron (shared secret, never a user). Each
// reminder is sent once thanks to its `ref`:
// - a class you booked starts within the hour
// - your plan ends within 3 days / has just ended (and you have no new one) —
//   only sent between 10:00 and 20:00 gym time, never at night

// ---- classes (dept_head creates; staff view) ----

// ---- class series (dept_head): recurring classes on chosen weekdays ----
// Class photos are uploaded straight to Storage by the app; we only keep an
// https link (anything else is dropped).
export function imageUrlField(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return /^https:\/\/\S+$/.test(s) && s.length <= 1000 ? s : null;
}
export function seriesFields(body: any) {
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
    row: { title, description: blankToNull(body.description), weekdays, start_time: startTime, duration_min: durationMin, drop_in_price: dropInPrice, monthly_price: monthlyPrice, image_url: imageUrlField(body.imageUrl) },
  } as const;
}



// Editing a series only changes the FUTURE: upcoming sessions nobody has
// booked are regenerated from the new schedule/prices; sessions that already
// have seats keep their time and price (staff can cancel them if needed).

// Ending stops it from recurring: future sessions without seats disappear,
// booked ones stay on the schedule for staff to run or cancel.

// ---- group plan catalog (dept_head): all-access memberships + class bundles ----
export function planTypeFields(body: any) {
  const kind = body.kind === "bundle" ? "bundle" : body.kind === "membership" ? "membership" : null;
  const name = String(body.name ?? "").trim();
  const price = Number(body.price);
  const durationMonths = Number(body.durationMonths);
  const credits = kind === "bundle" ? Number(body.credits) : null;
  const invitationsAllowance = Number(body.invitationsAllowance ?? 0);
  const sharedSeats = body.sharedSeats ? Number(body.sharedSeats) : null;
  if (!kind) return { error: "Choose a membership or a class bundle." } as const;
  if (!name) return { error: "Name is required." } as const;
  if (!Number.isFinite(price) || price < 0) return { error: "Price must be zero or more." } as const;
  if (!Number.isInteger(durationMonths) || durationMonths < 1) return { error: "Duration must be a whole number of months (1 or more)." } as const;
  if (kind === "bundle" && (!Number.isInteger(credits) || (credits as number) < 1)) return { error: "A bundle needs a whole number of classes (1 or more)." } as const;
  if (!Number.isInteger(invitationsAllowance) || invitationsAllowance < 0) return { error: "Invitations must be a whole number, zero or more." } as const;
  if (sharedSeats !== null) {
    if (kind !== "bundle") return { error: "Only a bundle can be shared." } as const;
    if (!Number.isInteger(sharedSeats) || sharedSeats < 2 || sharedSeats > 4) return { error: "A shared bundle is for 2 to 4 people." } as const;
    if ((credits as number) % sharedSeats !== 0) return { error: `${credits} sessions can't be split evenly between ${sharedSeats} people.` } as const;
  }
  return { row: { kind, name, price, duration_months: durationMonths, credits, invitations_allowance: invitationsAllowance, shared_seats: sharedSeats } } as const;
}



// Edits apply to future sales only — sold plans keep their snapshot. Kind
// can't change once created (a bundle's credits would be meaningless).


// ---- group plans: desk sales + a member's plan history ----
// Front desk sells to an existing member or creates the member in the same
// step (like memberships/sell did). One active plan per member, enforced in
// sellGroupPlan and by the database.


// ---- revenue (dept_head, accountant): the money view ----
// Revenue is new money in: sales paid by cash or card, recognised at the
// moment of sale. Sales paid from the wallet are NOT revenue — wallet credit
// comes from refunds (already counted when first sold), compensation and
// points rewards, none of which is new money. Coach payouts are the same
// numbers the payout screens use (group sessions × rate + private cuts).
export const REVENUE_TYPE_LABELS: Record<string, string> = {
  pt_bundle: "PT bundles", membership: "Memberships", class_monthly: "Class monthlies", bundle: "Class bundles",
  class_drop_in: "Class drop-ins", walk_in: "Walk-ins", legacy_membership: "Memberships (legacy)",
};
// pay_method is null on sales from before it was recorded (all desk sales).
export const NOT_WALLET = "pay_method.is.null,pay_method.neq.wallet";
export function monthsBack(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push(`${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

// ---- money by payment method (dept_head / accountant) ---------------------
// Every sale logs its tender (cash / card / instapay / wallet) in the activity
// log, so this is read from there: totals per method over the last N months, and
// the individual InstaPay transfers so they can be checked against a bank statement.
export const TENDER_LABELS: Record<string, string> = { cash: "Cash", card: "Card", instapay: "InstaPay", other: "Not recorded" };

// ---- bring existing members in from notes (dept_head / front desk / solo owner) ----
// One row per member: who they are and the plan they're on today. Historical
// plans are imported at price 0 so they never count as revenue; a row whose
// plan has already ended is imported as finished. A client with the same phone
// is skipped, not duplicated.

export type Sale = { month: string; amount: number; service: "private_training" | "group"; type: string; coachId?: string };

// Every sale in range, with its month, amount, service and type — the one
// calculation every revenue figure in the app (the dashboard, the P&L) reads
// from. Revenue counts a sale when it happens (cash basis), any tender
// except wallet — wallet-funded sales and wallet credit itself are excluded
// so client store credit is never counted twice (see Oversight.tsx).
export async function salesInRange(org: string, since: string): Promise<Sale[]> {
  const [pkgs, plans, drops, bookings, legacyMems, legacyTypes] = await Promise.all([
    admin().from("package_instances").select("purchased_at, price_at_sale, coach_id, client_id").eq("org_id", org).gte("purchased_at", since).or(NOT_WALLET),
    admin().from("group_plans").select("created_at, price_at_sale, kind, client_id").eq("org_id", org).gte("created_at", since).neq("pay_method", "wallet"),
    admin().from("drop_ins").select("created_at, price, class_id").eq("org_id", org).gte("created_at", since).or(NOT_WALLET),
    admin().from("class_bookings").select("booked_at, price_egp").eq("org_id", org).eq("coverage", "drop_in").eq("pay_status", "paid").is("drop_in_id", null).neq("pay_method", "wallet").gte("booked_at", since),
    admin().from("membership_instances").select("starts_at, membership_type_id").eq("org_id", org).gte("starts_at", since),
    admin().from("membership_types").select("id, price").eq("org_id", org),
  ]);
  const sales: Sale[] = [];
  const mo = (ts: string) => String(ts).slice(0, 7);
  for (const p of pkgs.data ?? []) sales.push({ month: mo(p.purchased_at), amount: Number(p.price_at_sale), service: "private_training", type: "pt_bundle", coachId: p.coach_id });
  for (const g of plans.data ?? []) sales.push({ month: mo(g.created_at), amount: Number(g.price_at_sale), service: "group", type: g.kind });
  for (const d of drops.data ?? []) sales.push({ month: mo(d.created_at), amount: Number(d.price), service: "group", type: d.class_id ? "class_drop_in" : "walk_in" });
  for (const b of bookings.data ?? []) sales.push({ month: mo(b.booked_at), amount: Number(b.price_egp), service: "group", type: "class_drop_in" });
  const legacyPrice = new Map((legacyTypes.data ?? []).map((t: any) => [t.id, Number(t.price)]));
  for (const m of legacyMems.data ?? []) sales.push({ month: mo(m.starts_at), amount: legacyPrice.get(m.membership_type_id) ?? 0, service: "group", type: "legacy_membership" });
  return sales;
}

// Refunds, by month, from the same two places Money.tsx lists them: a desk
// refund (cash/card/InstaPay, logged to activity_log) and a wallet refund
// (wallet_transactions, category "refund" — money that was never handed back
// but is still money the member no longer owes us for). Compensation and
// redeemed-points credits are gifts, not refunds, so they're excluded.
export async function refundsInRange(org: string, since: string): Promise<{ month: string; amount: number }[]> {
  const [desk, wallet] = await Promise.all([
    admin().from("activity_log").select("amount, created_at").eq("org_id", org).eq("type", "refund_desk").gte("created_at", since),
    admin().from("wallet_transactions").select("amount, created_at").eq("org_id", org).eq("type", "credit").eq("category", "refund").gte("created_at", since),
  ]);
  const mo = (ts: string) => String(ts).slice(0, 7);
  return [...(desk.data ?? []).map((r: any) => ({ month: mo(r.created_at), amount: Number(r.amount ?? 0) })),
          ...(wallet.data ?? []).map((r: any) => ({ month: mo(r.created_at), amount: Number(r.amount ?? 0) }))];
}


// ---- accounting: expenses, recurring expenses, profit & loss ----------
// Owner and accountant only. Coach payouts aren't a table here — they're
// read straight from `settlements` (one row per coach per settled month),
// so there's nothing to re-type and a reopened settlement is reflected
// automatically, with no separate sync step.
export async function requireAccountingStaff(c: any) {
  const user = await requireUser(c);
  const me = user && (await profileOf(user.id));
  if (!me || (me.role !== "dept_head" && me.role !== "accountant")) return null;
  return me;
}

export function toExpenseCategory(row: any) {
  return { id: row.id, name: row.name, sortOrder: row.sort_order, isDefault: row.is_default, archived: !!row.archived_at };
}
export function toRecurringExpense(row: any, categoryName: string) {
  return {
    id: row.id, categoryId: row.category_id, categoryName, amount: Number(row.amount), note: row.note ?? null,
    dayOfMonth: row.day_of_month, startMonth: row.start_month, endMonth: row.end_month ?? null, active: row.active,
  };
}
export function toExpense(row: any, categoryName: string, receiptUrl: string | null) {
  return {
    id: row.id, categoryId: row.category_id, categoryName, amount: Number(row.amount),
    date: row.expense_date, note: row.note ?? null, hasReceipt: !!row.receipt_path, receiptUrl,
    recurringId: row.recurring_id ?? null, createdBy: row.created_by,
    editedAfterMonthEnd: row.created_at.slice(0, 7) > row.expense_date.slice(0, 7),
  };
}

export const EXPENSE_RECEIPT_BUCKET = "expense-receipts";


export async function categoryNames(orgId: string): Promise<Map<string, string>> {
  const { data } = await admin().from("expense_categories").select("id, name").eq("org_id", orgId);
  return new Map((data ?? []).map((r: any) => [r.id, r.name]));
}






// This month's calendar month, Africa/Cairo (same clock the spec asks for;
// matches gymToday()'s own reasoning: a job running near midnight UTC must
// land on the gym's own day/month, not UTC's).
export function expenseMonthNow(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}
export function addMonthsIso(dateIso: string, months: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
export function monthRange(startMonth: string, endMonthExclusive: string): string[] {
  const out: string[] = [];
  for (let m = startMonth; m < endMonthExclusive; m = addMonthsIso(`${m}-01`, 1).slice(0, 7)) out.push(m);
  return out;
}

// One template's row for one month — a no-op if it's outside the template's
// own range, already made (the unique index on recurring_id+expense_date is
// the real guard; this check just avoids a wasted write), or paused.
export async function generateRecurringRow(template: any, month: string) {
  if (!template.active) return;
  if (month < template.start_month) return;
  if (template.end_month && month > template.end_month) return;
  const date = `${month}-${String(template.day_of_month).padStart(2, "0")}`;
  const { error } = await admin().from("expenses").insert({
    org_id: template.org_id, category_id: template.category_id, amount: template.amount, expense_date: date,
    note: template.note, recurring_id: template.id, created_by: template.created_by,
  });
  // 23505 = the unique index did its job — this month's row already exists.
  if (error && error.code !== "23505") console.log("generateRecurringRow failed", template.id, month, error.message);
}

// Fired nightly by pg_cron. Makes this month's row for every active
// template, and catches up any month a template's job was missed for
// (new template, a pause lifted, or the cron itself skipped a day) — the
// unique index means running this twice, or on a month already covered,
// never creates a duplicate.


// ---- staff: class bookings, attendance, pay-at-desk collection ----

// ---- staff: refunds (to wallet or "at desk") + goodwill compensation ----
// How much a client can still be refunded (shown in the desk's refund sheet).

// ---- staff activity feed / logs ----

// ---- invite a client to the branded app (front desk / dept_head) ----

// ---- ops: per-org branding + settings (bizqwik_team) ----


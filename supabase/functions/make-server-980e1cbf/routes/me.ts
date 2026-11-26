import type { Hono } from "npm:hono";
import {
  CHECKIN_BUFFER_MS,
  EXPENSE_RECEIPT_BUCKET,
  MONEY_RPC,
  NOT_WALLET,
  NO_EXPIRY,
  NO_ONE,
  OPS_INVITE_ROLES,
  OPS_ORG_STATUSES,
  P,
  PAY_METHODS,
  PROOF_BUCKET,
  REVENUE_TYPE_LABELS,
  SERIES_WINDOW_DAYS,
  SERVICE_ROLE,
  SUPABASE_URL,
  TENDER_LABELS,
  VERCEL_PROJECT,
  VERCEL_TEAM,
  WALLET_CREDIT_TITLES,
  activeGroupPlan,
  addDays,
  addMonths,
  addMonthsIso,
  admin,
  adminClient,
  assertLoggable,
  atMemberLocation,
  background,
  bizqwikTeamOf,
  blankToNull,
  buildRollupRows,
  bumpPointsBalance,
  canMutateSessions,
  categoryNames,
  classAudience,
  classGoing,
  clawbackPoints,
  clearFutureUnbookedSessions,
  clientMoneyHistory,
  clientOf,
  clientPlanStatus,
  conditionsOf,
  countsByOrg,
  creditWallet,
  currentMembershipForClient,
  currentMonth,
  currentPackageForClient,
  dayBoundsUtc,
  debitWallet,
  earnCheckinPoints,
  earnPoints,
  earnPurchasePoints,
  ensureVapid,
  expenseMonthNow,
  extendOrgSeries,
  fetchAllRows,
  fetchRetryingClockSkew,
  freezeDaysFor,
  generateRecurringRow,
  generateSeriesSessions,
  getSecret,
  gmvByOrg,
  gymDomain,
  gymToday,
  gymWhen,
  homePathForRole,
  imageUrlField,
  initialsOf,
  insertClient,
  isDeskStaff,
  isFrozen,
  isFutureMonth,
  localToUtcIso,
  locationField,
  locationNameOf,
  logActivity,
  materializeMembership,
  materializePackage,
  monthRange,
  monthRollups,
  monthRollupsMany,
  monthsBack,
  myClassIds,
  normPayMethod,
  notifyClient,
  orgInfoOf,
  orgModeOf,
  orgSettingsOf,
  orgTimezone,
  paidBySettlementMap,
  planCovers,
  planFields,
  planLimitError,
  planSummary,
  planTypeFields,
  pointsConfig,
  profileOf,
  ptScanPreview,
  recordCheckIn,
  refundableFor,
  refundsInRange,
  requireAccountingStaff,
  requireClient,
  requireUser,
  resolvePtScan,
  returnPlanCredit,
  salesInRange,
  secretCache,
  sellGroupPlan,
  sellPackageTo,
  sendPushToProfile,
  seriesFields,
  seriesToppedUp,
  soloOwnerOf,
  spendPoints,
  staffInMyOrg,
  stateOf,
  sweepGroupPlans,
  sweepOrgGroupPlans,
  sweepPointsExpiry,
  sweepWalletExpiry,
  tierOf,
  toBizqwikTeam,
  toBookingRow,
  toBundleType,
  toClassRow,
  toClassSeries,
  toClient,
  toClientAccount,
  toClientNotification,
  toExpense,
  toExpenseCategory,
  toGroupPlan,
  toGroupPlanType,
  toInvite,
  toLocation,
  toMembershipInstance,
  toPackageInstance,
  toPaymentRequest,
  toPlanType,
  toProfile,
  toRecurringExpense,
  toSession,
  toSettlement,
  toSettlementPayment,
  toTier,
  todayInTz,
  todayIso,
  tzCache,
  tzOffsetMs,
  vapidReady,
  vercelDomain,
  walletBalance
} from "../context.ts";
import type {
  CheckInResult,
  Sale
} from "../context.ts";

// Phase 3 slice: me
export function register(app: Hono) {
  app.get(`${P}/health`, (c) => c.json({ status: "ok" }));

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

  app.get(`${P}/me`, async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const [profile, team, client] = await Promise.all([profileOf(user.id), bizqwikTeamOf(user.id), clientOf(user.id)]);
    if (!profile && !team && !client) return c.json({ error: "No profile" }, 404);
    // Independent lookups, so read together rather than one after the other.
    const [tier, org] = await Promise.all([profile?.tier_id ? tierOf(profile.tier_id) : null, profile ? orgInfoOf(profile.org_id) : null]);
    const orgMode = org ? (org.mode === "solo" ? "solo" : "team") : null;
    return c.json({
      profile: profile ? toProfile(profile) : null,
      orgMode,
      org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      tier: tier ? toTier(tier) : null,
      bizqwikTeam: team ? toBizqwikTeam(team) : null,
      client: client ? toClientAccount(client) : null,
    });
  });

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

}

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

// Phase 3 slice: ops
export function register(app: Hono) {
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
        mode: o.mode === "solo" ? "solo" : "team",
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

    const domain = await vercelDomain("POST", org.slug);
    if (!domain.ok) console.error(`Could not connect ${gymDomain(org.slug)}:`, domain.reason);

    return c.json({
      org: { id: org.id, name: org.name, slug: org.slug, status: org.status, planId: org.plan_id ?? null },
      deptHeadEmail: headEmail,
      domain: { name: gymDomain(org.slug), connected: domain.ok, reason: domain.reason ?? null },
    });
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
        mode: org.mode === "solo" ? "solo" : "team",
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

  app.post(`${P}/ops/orgs/:id/mode`, async (c) => {
    const user = await requireUser(c);
    const team = user && (await bizqwikTeamOf(user.id));
    if (!team) return c.json({ error: "Forbidden" }, 403);
    const { mode } = await c.req.json();
    if (mode !== "solo" && mode !== "team") return c.json({ error: "Invalid mode." }, 400);
    const { data, error } = await admin().from("organizations").update({ mode }).eq("id", c.req.param("id")).select().maybeSingle();
    if (error) throw error;
    if (!data) return c.json({ error: "No such organization" }, 404);
    return c.json({ ok: true, mode: data.mode });
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

    const domain = await vercelDomain("DELETE", org.slug);
    if (!domain.ok) console.error(`Could not remove ${gymDomain(org.slug)}:`, domain.reason);

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

}

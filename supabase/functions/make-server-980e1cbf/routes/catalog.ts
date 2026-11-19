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

// Phase 3 slice: catalog
export function register(app: Hono) {
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

  app.get(`${P}/locations`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const { data, error } = await admin().from("locations").select("*").eq("org_id", me.org_id).order("sort").order("created_at");
    if (error) throw error;
    return c.json({ locations: (data ?? []).map(toLocation) });
  });

  app.post(`${P}/locations`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
    const name = String((await c.req.json()).name ?? "").trim();
    if (!name) return c.json({ error: "Give the location a name." }, 400);
    const { data: existing } = await admin().from("locations").select("id").eq("org_id", me.org_id);
    if ((existing?.length ?? 0) >= 10) return c.json({ error: "Up to 10 locations." }, 400);
    const { data, error } = await admin().from("locations").insert({ org_id: me.org_id, name, sort: existing?.length ?? 0 }).select().single();
    if (error) throw error;
    return c.json({ location: toLocation(data) });
  });

  app.post(`${P}/locations/update`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const name = String(body.name ?? "").trim();
    if (!name) return c.json({ error: "Give the location a name." }, 400);
    const { data, error } = await admin().from("locations").update({ name }).eq("id", String(body.id ?? "")).eq("org_id", me.org_id).select().maybeSingle();
    if (error) throw error;
    if (!data) return c.json({ error: "No such location" }, 404);
    return c.json({ location: toLocation(data) });
  });

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
    const { name, price, sessionsIncluded, expiryDays, locationId } = await c.req.json();
    const loc = await locationField(me.org_id, locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const { data, error } = await admin()
      .from("bundle_types")
      .insert({ org_id: me.org_id, name, price: Number(price), sessions_included: Number(sessionsIncluded), expiry_days: Number(expiryDays), location_id: loc.id ?? null })
      .select()
      .single();
    if (error) throw error;
    return c.json({ bundleType: toBundleType(data) });
  });

  app.post(`${P}/bundle-types/update`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
    const { id, name, price, sessionsIncluded, expiryDays, locationId, active } = await c.req.json();
    const loc = await locationField(me.org_id, locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const bundlePatch: any = { name, price: Number(price), sessions_included: Number(sessionsIncluded), expiry_days: Number(expiryDays) };
    if (active !== undefined) bundlePatch.active = !!active;
    if (loc.id !== undefined) bundlePatch.location_id = loc.id;
    const { data, error } = await admin()
      .from("bundle_types")
      .update(bundlePatch)
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
    const body = await c.req.json();
    const parsed = seriesFields(body);
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    const loc = await locationField(me.org_id, body.locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const { data, error } = await admin().from("class_series").insert({ org_id: me.org_id, ...parsed.row, created_by: me.id, location_id: loc.id ?? null }).select().single();
    if (error) throw error;
    await generateSeriesSessions(data, await orgTimezone(me.org_id));
    await logActivity(me.org_id, "class_series_created", { actorId: me.id, meta: { seriesId: data.id, title: data.title } });
    return c.json({ series: toClassSeries(data) });
  });

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
    const loc = await locationField(me.org_id, body.locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const seriesPatch: any = { ...parsed.row, generated_until: null };
    if (loc.id !== undefined) seriesPatch.location_id = loc.id;
    const { data, error } = await admin().from("class_series").update(seriesPatch).eq("id", existing.id).select().single();
    if (error) throw error;
    const cleared = await clearFutureUnbookedSessions(existing.id);
    // Booked future sessions keep their slot/price, but follow the new name and place.
    await admin().from("classes").update({ title: data.title, description: data.description, location_id: data.location_id ?? null }).eq("series_id", existing.id).gt("starts_at", new Date().toISOString());
    await generateSeriesSessions(data, await orgTimezone(me.org_id));
    return c.json({ series: toClassSeries(data), keptBookedSessions: cleared.kept });
  });

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
    const body = await c.req.json();
    const parsed = planTypeFields(body);
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);
    const loc = await locationField(me.org_id, body.locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const { data, error } = await admin().from("group_plan_types").insert({ org_id: me.org_id, ...parsed.row, location_id: loc.id ?? null }).select().single();
    if (error) throw error;
    return c.json({ planType: toGroupPlanType(data) });
  });

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
    const loc = await locationField(me.org_id, body.locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const typePatch: any = { ...parsed.row, active };
    if (loc.id !== undefined) typePatch.location_id = loc.id;
    const { data, error } = await admin().from("group_plan_types").update(typePatch).eq("id", existing.id).select().single();
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

}

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

// Phase 3 slice: client-app
export function register(app: Hono) {
  app.get(`${P}/client/branding`, async (c) => {
    const slug = c.req.query("slug") || "";
    const { data: org } = await admin().from("organizations").select("id, name, slug, status, mode").eq("slug", slug).maybeSingle();
    if (!org) return c.json({ error: "Unknown gym" }, 404);
    const [{ data: b }, { data: locs }] = await Promise.all([
      admin().from("org_branding").select("*").eq("org_id", org.id).maybeSingle(),
      admin().from("locations").select("id, name").eq("org_id", org.id).order("sort").order("created_at"),
    ]);
    return c.json({
      org: { id: org.id, name: org.name, slug: org.slug, status: org.status, mode: org.mode === "solo" ? "solo" : "team" },
      locations: (locs ?? []).map(toLocation),
      branding: {
        appName: b?.app_name ?? org.name,
        logoUrl: b?.logo_url ?? null,
        iconUrl: b?.icon_url ?? null,
        primaryColor: b?.primary_color ?? null,
        onboardingAssets: b?.onboarding_assets ?? [],
      },
    });
  });

  app.post(`${P}/client/location`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const loc = await locationField(me.org_id, (await c.req.json().catch(() => ({}))).locationId ?? null);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    await admin().from("clients").update({ home_location_id: loc.id ?? null }).eq("id", me.id);
    return c.json({ ok: true, homeLocationId: loc.id ?? null });
  });

  app.get(`${P}/client/home`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    await extendOrgSeries(me.org_id);
    // Everything Home shows, in one call: the plan, balances, the unread count,
    // and the next 7 days of classes (with whether the member has booked each).
    const now = new Date();
    const [status, wallet, points, cfg, upcoming, mine, going, unread] = await Promise.all([
      clientPlanStatus(me.id, me.org_id),
      walletBalance(me.id, me.org_id),
      bumpPointsBalance(me.id, me.org_id),
      pointsConfig(me.org_id),
      atMemberLocation(admin().from("classes").select("*, class_series(image_url)").eq("org_id", me.org_id).eq("status", "active").gte("starts_at", now.toISOString()).lt("starts_at", new Date(now.getTime() + 7 * 86400000).toISOString()), me).order("starts_at").limit(80),
      myClassIds(me),
      classGoing(me.org_id, me.id),
      admin().from("client_notifications").select("id", { count: "exact", head: true }).eq("client_id", me.id).is("read_at", null),
    ]);
    const booked = mine;
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
      upcomingClasses: (upcoming.data ?? []).map((r: any) => ({ ...toClassRow(r), booked: booked.has(r.id), coverage: planCovers(plan, r) ? "plan" : "drop_in", going: going.get(r.id) ?? NO_ONE })),
      unreadNotifications: unread.count ?? 0,
    });
  });

  app.get(`${P}/client/classes`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    await extendOrgSeries(me.org_id);
    const [{ data }, mine, plan, going] = await Promise.all([
      atMemberLocation(admin().from("classes").select("*, class_series(image_url)").eq("org_id", me.org_id).eq("status", "active").gte("starts_at", new Date().toISOString()), me).order("starts_at"),
      myClassIds(me),
      activeGroupPlan(me.id, me.org_id),
      classGoing(me.org_id, me.id),
    ]);
    const booked = mine;
    return c.json({
      activePlan: plan ? toGroupPlan(plan) : null,
      classes: (data ?? []).map((r: any) => ({ ...toClassRow(r), booked: booked.has(r.id), coverage: planCovers(plan, r) ? "plan" : "drop_in", going: going.get(r.id) ?? NO_ONE })),
    });
  });

  app.post(`${P}/client/classes/:id/rsvp`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    if ((await orgModeOf(me.org_id)) !== "solo") return c.json({ error: "Book this class instead." }, 400);
    const classId = c.req.param("id");
    const { going } = await c.req.json().catch(() => ({ going: true }));
    if (going === false) {
      await admin().from("class_rsvps").delete().eq("class_id", classId).eq("client_id", me.id);
      return c.json({ ok: true, going: false });
    }
    const { data: cls } = await atMemberLocation(admin().from("classes").select("id, starts_at").eq("id", classId).eq("org_id", me.org_id).eq("status", "active"), me).maybeSingle();
    if (!cls) return c.json({ error: "This class isn't available." }, 404);
    if (Date.parse(cls.starts_at) <= Date.now()) return c.json({ error: "This class has already started." }, 400);
    const { error } = await admin().from("class_rsvps").upsert({ class_id: classId, client_id: me.id, org_id: me.org_id }, { onConflict: "class_id,client_id", ignoreDuplicates: true });
    if (error) throw error;
    return c.json({ ok: true, going: true });
  });

  app.post(`${P}/client/classes/:id/book`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const classId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    if ((await orgModeOf(me.org_id)) === "solo") return c.json({ error: "Booking isn't open here — just turn up and check in.", code: "booking_closed" }, 400);
    const { data: cls } = await admin().from("classes").select("*").eq("id", classId).eq("org_id", me.org_id).eq("status", "active").maybeSingle();
    if (!cls) return c.json({ error: "This class isn't available." }, 404);
    if (Date.parse(cls.starts_at) <= Date.now()) return c.json({ error: "This class has already started." }, 400);
    const { data: existing } = await admin().from("class_bookings").select("id, attendance").eq("class_id", classId).eq("client_id", me.id).maybeSingle();
    if (existing && existing.attendance !== "cancelled") return c.json({ error: "You've already booked this class." }, 400);

    const plan = await activeGroupPlan(me.id, me.org_id);
    if (plan && planCovers(plan, cls) && !body.useDropIn) {
      // Booking only reserves the spot. A bundle session is used when the member
      // checks in on arrival; cancelling or not showing up costs nothing.
      const { data: booking, error } = await admin().from("class_bookings").upsert(
        { org_id: me.org_id, class_id: classId, client_id: me.id, coverage: "plan", group_plan_id: plan.id, drop_in_id: null, pay_method: "plan", pay_status: "paid", attendance: "booked", price_egp: 0, credit_spent: false, booked_at: new Date().toISOString() },
        { onConflict: "class_id,client_id" },
      ).select().single();
      if (error) throw error;
      await logActivity(me.org_id, "class_booked", { clientId: me.id, amount: 0, meta: { classId, title: cls.title, coverage: "plan", plan: plan.name } });
      await notifyClient(me.org_id, me.id, "booked", {
        title: `You're in: ${cls.title}`,
        body: `${await gymWhen(me.org_id, cls.starts_at)} · on your ${plan.name}${plan.kind === "bundle" ? ". A session is used when you check in." : "."}`,
      });
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
      { org_id: me.org_id, class_id: classId, client_id: me.id, coverage: "drop_in", group_plan_id: null, drop_in_id: null, pay_method: payMethod, pay_status: payStatus, attendance: "booked", price_egp: price, credit_spent: false, booked_at: new Date().toISOString() },
      { onConflict: "class_id,client_id" },
    ).select().single();
    if (error) throw error;
    await logActivity(me.org_id, "class_booked", { clientId: me.id, amount: price, meta: { classId, title: cls.title, payMethod, coverage: "drop_in" } });
    await notifyClient(me.org_id, me.id, "booked", {
      title: `You're in: ${cls.title}`,
      body: `${await gymWhen(me.org_id, cls.starts_at)} · ${price <= 0 ? "free" : payMethod === "wallet" ? `${price} EGP paid from your wallet` : `pay ${price} EGP at the desk`}.`,
    });
    return c.json({ booking: toBookingRow(booking) });
  });

  app.get(`${P}/client/plans`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const plan = await activeGroupPlan(me.id, me.org_id);
    const [{ data: history }, { data: types }, { data: series }, wallet] = await Promise.all([
      admin().from("group_plans").select("*").eq("client_id", me.id).order("created_at", { ascending: false }).limit(20),
      atMemberLocation(admin().from("group_plan_types").select("*").eq("org_id", me.org_id).eq("active", true).is("shared_seats", null), me).order("price"),
      atMemberLocation(admin().from("class_series").select("*").eq("org_id", me.org_id).eq("status", "active"), me).order("title"),
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

  app.post(`${P}/client/plans/freeze`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const plan = await activeGroupPlan(me.id, me.org_id);
    if (!plan) return c.json({ error: "You don't have an active plan to freeze.", code: "no_plan" }, 400);
    const days = Number(plan.freeze_days ?? 0);
    if (days <= 0) return c.json({ error: "This plan doesn't include a freeze.", code: "no_freeze" }, 400);
    if (isFrozen(plan)) return c.json({ error: `Your plan is already frozen until ${String(plan.frozen_until).slice(0, 10)}.`, code: "already_frozen" }, 400);
    if (plan.freeze_used) return c.json({ error: "You've already used this plan's freeze.", code: "freeze_used" }, 400);
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400000);
    const newEnd = new Date(Date.parse(plan.expires_at) + days * 86400000);
    // Compare-and-set so a double tap freezes (and extends) only once.
    const { data: updated } = await admin().from("group_plans")
      .update({ frozen_from: now.toISOString(), frozen_until: until.toISOString(), expires_at: newEnd.toISOString(), freeze_used: true, thaw_notified: false })
      .eq("id", plan.id).eq("freeze_used", false).select().maybeSingle();
    if (!updated) return c.json({ error: "Your plan was just updated — please try again." }, 409);
    await logActivity(me.org_id, "plan_frozen", { clientId: me.id, meta: { planId: plan.id, name: plan.name, days } });
    await notifyClient(me.org_id, me.id, "plan_frozen", {
      title: `${plan.name} is frozen`,
      body: `Frozen until ${until.toISOString().slice(0, 10)}. It restarts by itself, and now ends on ${newEnd.toISOString().slice(0, 10)}.`,
    });
    return c.json({ plan: toGroupPlan(updated) });
  });

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

  app.get(`${P}/client/prices`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const solo = (await orgModeOf(me.org_id)) === "solo";
    const [plan, pkg, { data: types }, { data: bundles }, { data: org }, { data: reqs }] = await Promise.all([
      activeGroupPlan(me.id, me.org_id),
      currentPackageForClient(me.id, me.org_id),
      atMemberLocation(admin().from("group_plan_types").select("*").eq("org_id", me.org_id).eq("active", true).eq("kind", "bundle").is("shared_seats", null), me).order("price"),
      atMemberLocation(admin().from("bundle_types").select("*").eq("org_id", me.org_id).eq("active", true), me).order("price"),
      admin().from("organizations").select("instapay_address, instapay_qr").eq("id", me.org_id).maybeSingle(),
      admin().from("payment_requests").select("*").eq("client_id", me.id).order("created_at", { ascending: false }).limit(5),
    ]);
    const pending = (reqs ?? []).find((r: any) => r.status === "pending") ?? null;
    const ptActive = !!pkg && pkg.status === "active" && Number(pkg.sessions_remaining) > 0;
    return c.json({
      solo,
      pay: { address: org?.instapay_address ?? null, qr: org?.instapay_qr ?? null },
      activePlan: plan ? toGroupPlan(plan) : null,
      activePackage: ptActive ? { name: null, sessionsRemaining: Number(pkg.sessions_remaining), sessionsIncluded: Number(pkg.sessions_included), expiresAt: pkg.expires_at } : null,
      offers: [
        ...(types ?? []).map((t: any) => ({ offerType: "plan_type", id: t.id, name: t.name, price: Number(t.price), months: t.duration_months, count: t.credits, locationId: t.location_id ?? null, canRequest: !plan })),
        ...(bundles ?? []).map((b: any) => ({ offerType: "bundle_type", id: b.id, name: b.name, price: Number(b.price), months: null, expiryDays: b.expiry_days >= NO_EXPIRY ? null : Number(b.expiry_days), count: b.sessions_included, locationId: b.location_id ?? null, canRequest: !ptActive })),
      ],
      pending: pending ? toPaymentRequest(pending) : null,
      recent: (reqs ?? []).filter((r: any) => r.status !== "pending").slice(0, 3).map(toPaymentRequest),
    });
  });

  app.post(`${P}/client/payment-requests`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    if ((await orgModeOf(me.org_id)) !== "solo") return c.json({ error: "Pay at the desk." }, 400);
    const { offerType, id, proof } = await c.req.json();
    const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(String(proof ?? ""));
    if (!m) return c.json({ error: "Upload a screenshot of your InstaPay receipt." }, 400);
    const bytes = Uint8Array.from(atob(m[3]), (ch) => ch.charCodeAt(0));
    if (bytes.length > 2_500_000) return c.json({ error: "That image is too large. Try a smaller screenshot." }, 400);

    let row: any;
    if (offerType === "plan_type") {
      const { data: t } = await atMemberLocation(admin().from("group_plan_types").select("*").eq("id", id).eq("org_id", me.org_id).eq("active", true).eq("kind", "bundle").is("shared_seats", null), me).maybeSingle();
      if (!t) return c.json({ error: "That plan isn't on sale." }, 404);
      if (await activeGroupPlan(me.id, me.org_id)) return c.json({ error: "You already have an active plan. You can get a new one once it's finished.", code: "active_plan" }, 400);
      row = { offer_type: "plan_type", plan_type_id: t.id, name: t.name, price: Number(t.price), location_id: t.location_id ?? null };
    } else if (offerType === "bundle_type") {
      const { data: b } = await atMemberLocation(admin().from("bundle_types").select("*").eq("id", id).eq("org_id", me.org_id).eq("active", true), me).maybeSingle();
      if (!b) return c.json({ error: "That package isn't on sale." }, 404);
      const pkg = await currentPackageForClient(me.id, me.org_id);
      if (pkg && pkg.status === "active") return c.json({ error: "You already have an active package.", code: "active_package" }, 400);
      row = { offer_type: "bundle_type", bundle_type_id: b.id, name: b.name, price: Number(b.price), location_id: b.location_id ?? null };
    } else {
      return c.json({ error: "Choose what you're paying for." }, 400);
    }

    // The unique index allows one waiting request per member.
    const { data: req, error } = await admin().from("payment_requests").insert({ org_id: me.org_id, client_id: me.id, ...row }).select().single();
    if (error) {
      if (error.code === "23505") return c.json({ error: "You already have a payment waiting for approval.", code: "pending_exists" }, 409);
      throw error;
    }
    const path = `${me.org_id}/${req.id}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
    const up = await admin().storage.from(PROOF_BUCKET).upload(path, bytes, { contentType: m[1], upsert: true });
    if (up.error) {
      await admin().from("payment_requests").delete().eq("id", req.id);
      return c.json({ error: "Couldn't upload your screenshot. Please try again." }, 500);
    }
    await admin().from("payment_requests").update({ proof_path: path }).eq("id", req.id);

    const { data: owners } = await admin().from("profiles").select("id").eq("org_id", me.org_id).eq("role", "dept_head");
    await Promise.all((owners ?? []).map((o: any) => sendPushToProfile(me.org_id, o.id, "payment_request", { title: "Payment to approve", body: `${me.name} paid ${row.price} EGP for ${row.name}.`, url: "/" })));
    return c.json({ request: toPaymentRequest({ ...req, proof_path: path }) });
  });

  app.post(`${P}/client/payment-requests/:id/cancel`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const { data } = await admin().from("payment_requests").update({ status: "cancelled", reviewed_at: new Date().toISOString() }).eq("id", c.req.param("id")).eq("client_id", me.id).eq("status", "pending").select("id").maybeSingle();
    if (!data) return c.json({ error: "That request is no longer waiting." }, 400);
    return c.json({ ok: true });
  });

  app.get(`${P}/client/bookings`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const { data } = await admin().from("class_bookings").select("*, classes(title, starts_at, image_url, class_series(image_url))").eq("client_id", me.id).order("booked_at", { ascending: false });
    return c.json({ bookings: (data ?? []).map((r: any) => ({ ...toBookingRow(r), classTitle: r.classes?.title ?? null, classStartsAt: r.classes?.starts_at ?? null, classImageUrl: r.classes?.image_url ?? r.classes?.class_series?.image_url ?? null })) });
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
      creditReturned = !!booking.credit_spent;
    } else if (booking.pay_status === "paid" && booking.pay_method === "wallet") {
      await creditWallet(me.id, me.org_id, Number(booking.price_egp), "refund", "Refund: cancelled booking");
      refunded = Number(booking.price_egp);
    }
    await admin().from("class_bookings").update({ attendance: "cancelled", pay_status: booking.pay_status === "paid" ? "refunded" : booking.pay_status }).eq("id", id);
    await logActivity(me.org_id, "class_cancelled", { clientId: me.id, amount: refunded, meta: { bookingId: id, coverage: booking.coverage } });
    const { data: clsName } = await admin().from("classes").select("title").eq("id", booking.class_id).maybeSingle();
    await notifyClient(me.org_id, me.id, "booking_cancelled", {
      title: `Booking cancelled: ${clsName?.title ?? "class"}`,
      body: refunded > 0 ? `${refunded} EGP is back in your wallet.` : creditReturned ? "Your session is back on your bundle." : "Nothing was charged.",
    });
    return c.json({ ok: true, refundedToWallet: refunded, planCreditReturned: creditReturned });
  });

  app.post(`${P}/client/check-in`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const { token } = await c.req.json();
    const { data: org } = await admin().from("organizations").select("id, slug").eq("id", me.org_id).maybeSingle();
    if (!token || (token !== org?.slug && token !== org?.id)) return c.json({ error: "That QR isn't your gym's check-in code." }, 400);
    const r = await recordCheckIn(me.org_id, me.id, me.name, "qr", null, true);
    if (!r.ok) return c.json({ error: r.error, code: r.code ?? null, plan: r.plan ?? null }, r.status as any);
    return c.json({ ok: true, deducted: r.deducted, plan: r.plan });
  });

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
    await notifyClient(me.org_id, me.id, "points_redeemed", { title: `${egpCredited} EGP added to your wallet`, body: `You redeemed ${pointsSpent.toLocaleString("en-US")} points.` });
    return c.json({ pointsSpent, egpCredited, points: after, wallet });
  });

  app.get(`${P}/client/notifications`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const [{ data }, { count }] = await Promise.all([
      admin().from("client_notifications").select("*").eq("client_id", me.id).order("created_at", { ascending: false }).limit(60),
      admin().from("client_notifications").select("id", { count: "exact", head: true }).eq("client_id", me.id).is("read_at", null),
    ]);
    return c.json({ notifications: (data ?? []).map(toClientNotification), unread: count ?? 0 });
  });

  app.post(`${P}/client/notifications/read`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const { ids } = await c.req.json().catch(() => ({}));
    let q = admin().from("client_notifications").update({ read_at: new Date().toISOString() }).eq("client_id", me.id).is("read_at", null);
    if (Array.isArray(ids)) {
      if (ids.length === 0) return c.json({ ok: true });
      q = q.in("id", ids.map(String));
    }
    const { error } = await q;
    if (error) throw error;
    return c.json({ ok: true });
  });

  app.post(`${P}/client/push/subscribe`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const { endpoint, keys, deviceId } = await c.req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) return c.json({ error: "Invalid subscription." }, 400);
    if (!deviceId) return c.json({ error: "Missing device id." }, 400);
    // Same stale-endpoint cleanup as the staff app (iOS can rotate endpoints).
    await admin().from("client_push_subscriptions").delete().eq("client_id", me.id).eq("endpoint", endpoint).neq("id", deviceId);
    const { error } = await admin().from("client_push_subscriptions").upsert({
      id: deviceId, org_id: me.org_id, client_id: me.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return c.json({ ok: true });
  });

  app.post(`${P}/client/push/unsubscribe`, async (c) => {
    const me = await requireClient(c);
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const { endpoint, deviceId } = await c.req.json().catch(() => ({}));
    if (deviceId) await admin().from("client_push_subscriptions").delete().eq("id", deviceId).eq("client_id", me.id);
    else if (endpoint) await admin().from("client_push_subscriptions").delete().eq("endpoint", endpoint).eq("client_id", me.id);
    return c.json({ ok: true });
  });

  app.post(`${P}/push/client-reminders`, async (c) => {
    const provided = c.req.header("x-cron-secret") || "";
    const expected = await getSecret("cron_secret");
    if (provided !== expected) return c.json({ error: "Forbidden" }, 403);
    const now = Date.now();
    let sent = 0;

    const { data: soon } = await admin().from("class_bookings").select("id, org_id, client_id, classes!inner(title, starts_at, status)")
      .eq("attendance", "booked").eq("classes.status", "active")
      .gt("classes.starts_at", new Date(now).toISOString()).lte("classes.starts_at", new Date(now + 3600000).toISOString());
    for (const b of soon ?? []) {
      const cls = (b as any).classes;
      const mins = Math.max(1, Math.round((Date.parse(cls.starts_at) - now) / 60000));
      await notifyClient(b.org_id, b.client_id, "class_soon", {
        title: `${cls.title} starts in ${mins} min`,
        body: "Scan the check-in QR at the desk when you arrive.",
        ref: b.id,
        push: true,
      });
      sent++;
    }

    // A freeze that has run its course: the plan is already active again (that is
    // computed from the dates); this just tells the member.
    const { data: thawed } = await admin().from("group_plans").select("id, org_id, client_id, name, expires_at")
      .eq("thaw_notified", false).not("frozen_until", "is", null).lte("frozen_until", new Date(now).toISOString());
    for (const p of thawed ?? []) {
      const { data: done } = await admin().from("group_plans").update({ thaw_notified: true }).eq("id", p.id).eq("thaw_notified", false).select("id").maybeSingle();
      if (!done) continue;
      await notifyClient(p.org_id, p.client_id, "plan_unfrozen", {
        title: `${p.name} is active again`,
        body: `Your freeze is over. Your plan runs until ${String(p.expires_at).slice(0, 10)}.`,
        ref: p.id,
        push: true,
      });
      sent++;
    }

    // Solo gyms: no bookings, so everyone at the class's location hears it.
    const { data: soloOrgs } = await admin().from("organizations").select("id").eq("mode", "solo");
    for (const org of soloOrgs ?? []) {
      const { data: upcoming } = await admin().from("classes").select("id, title, starts_at, location_id")
        .eq("org_id", org.id).eq("status", "active")
        .gt("starts_at", new Date(now).toISOString()).lte("starts_at", new Date(now + 3600000).toISOString());
      for (const cls of upcoming ?? []) {
        const mins = Math.max(1, Math.round((Date.parse(cls.starts_at) - now) / 60000));
        for (const clientId of await classAudience(org.id, cls.location_id ?? null)) {
          await notifyClient(org.id, clientId, "class_soon", {
            title: `${cls.title} starts in ${mins} min`,
            body: "See you there — scan the check-in QR when you arrive.",
            ref: cls.id,
            push: true,
          });
          sent++;
        }
      }
    }

    // Plan reminders only in daytime at each gym.
    const hourCache = new Map<string, number>();
    const daytime = async (orgId: string) => {
      if (!hourCache.has(orgId)) {
        const tz = await orgTimezone(orgId);
        hourCache.set(orgId, Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date(now))));
      }
      const h = hourCache.get(orgId)!;
      return h >= 10 && h < 20;
    };

    const { data: ending } = await admin().from("group_plans").select("id, org_id, client_id, name, expires_at")
      .eq("status", "active").gt("expires_at", new Date(now).toISOString()).lte("expires_at", new Date(now + 3 * 86400000).toISOString());
    for (const p of ending ?? []) {
      if (!(await daytime(p.org_id))) continue;
      const days = Math.max(1, Math.ceil((Date.parse(p.expires_at) - now) / 86400000));
      await notifyClient(p.org_id, p.client_id, "plan_ending", {
        title: `${p.name} ends in ${days} day${days === 1 ? "" : "s"}`,
        body: "Renew now to keep booking classes without a gap.",
        ref: p.id,
        push: true,
      });
      sent++;
    }

    const { data: ended } = await admin().from("group_plans").select("id, org_id, client_id, name, expires_at")
      .lte("expires_at", new Date(now).toISOString()).gt("expires_at", new Date(now - 2 * 86400000).toISOString());
    for (const p of ended ?? []) {
      if (!(await daytime(p.org_id))) continue;
      const { data: newer } = await admin().from("group_plans").select("id").eq("client_id", p.client_id).eq("status", "active").gt("expires_at", new Date(now).toISOString()).limit(1);
      if (newer?.length) continue;
      await notifyClient(p.org_id, p.client_id, "plan_ended", {
        title: `${p.name} has ended`,
        body: "Pick a new plan to keep training with us.",
        ref: p.id,
        push: true,
      });
      sent++;
    }
    return c.json({ sent });
  });

}

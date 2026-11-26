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

// Phase 3 slice: classes
export function register(app: Hono) {
  app.get(`${P}/classes`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    if (me.role === "accountant") return c.json({ error: "Forbidden" }, 403);
    await extendOrgSeries(me.org_id);
    // Recurring series generate lots of sessions, so the list is windowed:
    // the last 14 days (for rosters/attendance) through everything scheduled.
    const since = c.req.query("since") || new Date(Date.now() - 14 * 86400000).toISOString();
    const { data } = await admin().from("classes").select("*, class_series(image_url)").eq("org_id", me.org_id).gte("starts_at", since).order("starts_at", { ascending: true });
    const ids = (data ?? []).map((r: any) => r.id);
    const solo = (await orgModeOf(me.org_id)) === "solo";
    // Solo: who said they're coming (names are for her eyes only).
    const comingBy = new Map<string, string[]>();
    if (solo && ids.length > 0) {
      const { data: rs } = await admin().from("class_rsvps").select("class_id, clients(name)").in("class_id", ids).order("created_at");
      for (const r of rs ?? []) comingBy.set(r.class_id, [...(comingBy.get(r.class_id) ?? []), (r as any).clients?.name ?? "Member"]);
    }
    const { data: seats } = ids.length > 0 && !solo
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
        const coming = comingBy.get(r.id) ?? [];
        return { ...toClassRow(r), bookedCount: solo ? coming.length : n.plan + n.dropIn, planSeats: n.plan, dropInSeats: n.dropIn, ...(solo ? { coming } : {}) };
      }),
    });
  });

  app.post(`${P}/classes`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
    const { title, description, startsAt, price, imageUrl, locationId } = await c.req.json();
    if (!String(title ?? "").trim()) return c.json({ error: "Title is required." }, 400);
    if (!startsAt) return c.json({ error: "Pick a date and time." }, 400);
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) return c.json({ error: "Price must be zero or more." }, 400);
    const loc = await locationField(me.org_id, locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const { data, error } = await admin().from("classes").insert({ org_id: me.org_id, title: String(title).trim(), description: description ?? null, starts_at: startsAt, price_egp: p, image_url: imageUrlField(imageUrl), created_by: me.id, location_id: loc.id ?? null }).select().single();
    if (error) throw error;
    return c.json({ class: toClassRow(data) });
  });

  app.post(`${P}/classes/update`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head") return c.json({ error: "Forbidden" }, 403);
    const { id, title, description, startsAt, price, imageUrl, locationId } = await c.req.json();
    const p = Number(price);
    if (!String(title ?? "").trim()) return c.json({ error: "Title is required." }, 400);
    if (!Number.isFinite(p) || p < 0) return c.json({ error: "Price must be zero or more." }, 400);
    const loc = await locationField(me.org_id, locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const patch: any = { title: String(title).trim(), description: description ?? null, starts_at: startsAt, price_egp: p, image_url: imageUrlField(imageUrl) };
    if (loc.id !== undefined) patch.location_id = loc.id;
    const { data, error } = await admin().from("classes").update(patch).eq("id", id).eq("org_id", me.org_id).select().maybeSingle();
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
        await creditWallet(b.client_id, me.org_id, Number(b.price_egp), "refund", `Refund: ${cls.title} cancelled`, me.id);
      }
      await admin().from("class_bookings").update({ attendance: "cancelled", pay_status: b.pay_status === "paid" ? "refunded" : b.pay_status }).eq("id", b.id);
      const walletBack = b.coverage !== "plan" && b.pay_status === "paid" && b.pay_method === "wallet" ? Number(b.price_egp) : 0;
      await notifyClient(me.org_id, b.client_id, "class_cancelled", {
        title: `${cls.title} is cancelled`,
        body: `The gym cancelled ${cls.title} on ${await gymWhen(me.org_id, cls.starts_at)}.${walletBack > 0 ? ` ${walletBack} EGP is back in your wallet.` : ""} Sorry about that!`,
        push: true,
      });
    }
    if ((await orgModeOf(me.org_id)) === "solo") {
      for (const clientId of await classAudience(me.org_id, cls.location_id ?? null)) {
        await notifyClient(me.org_id, clientId, "class_cancelled", {
          title: `${cls.title} is cancelled`,
          body: `${cls.title} on ${await gymWhen(me.org_id, cls.starts_at)} has been cancelled. Sorry about that!`,
          ref: `cancel-${id}`,
          push: true,
        });
      }
    }
    await admin().from("classes").update({ status: "cancelled" }).eq("id", id);
    await logActivity(me.org_id, "class_cancelled_by_staff", { actorId: me.id, meta: { classId: id, title: cls.title } });
    return c.json({ ok: true });
  });

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

}

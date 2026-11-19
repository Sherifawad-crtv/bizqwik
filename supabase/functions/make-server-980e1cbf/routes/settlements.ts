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

// Phase 3 slice: settlements
export function register(app: Hono) {
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

  app.post(`${P}/sessions/add`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const body = await c.req.json();
    const { coachId } = body;
    let { month, date } = body;
    if (!canMutateSessions(me, coachId)) return c.json({ error: "Forbidden" }, 403);
    if (!(await staffInMyOrg(me, coachId))) return c.json({ error: "No such coach" }, 404);
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
    if (!(await staffInMyOrg(me, coachId))) return c.json({ error: "No such coach" }, 404);
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
    if (!(await staffInMyOrg(me, coachId))) return c.json({ error: "No such coach" }, 404);
    const blocked = await assertLoggable(me.org_id, coachId, month);
    if (blocked) return c.json({ error: blocked }, 400);
    await admin().from("sessions").delete().eq("id", id).eq("org_id", me.org_id);
    return c.json({ ok: true });
  });

  app.post(`${P}/settle`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    if (me.role !== "dept_head" && me.role !== "head_coach") return c.json({ error: "Forbidden" }, 403);
    const { coachId, month } = await c.req.json();
    if (isFutureMonth(month)) return c.json({ error: "This month hasn't started yet." }, 400);

    const { data: existingSettlement } = await admin().from("settlements").select("*").eq("org_id", me.org_id).eq("coach_id", coachId).eq("month", month).maybeSingle();
    if (stateOf(existingSettlement) !== "logging") return c.json({ error: "Already settled." }, 400);

    const coach = await staffInMyOrg(me, coachId);
    if (!coach) return c.json({ error: "No such coach" }, 404);
    const tier = coach.tier_id ? await tierOf(coach.tier_id) : null;
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

    await sendPushToProfile(me.org_id, coachId, "month_settled", {
      title: "💰 Month settled",
      body: `Your account for ${month} has been settled. Tap here to view the details.`,
      url: homePathForRole(coach.role),
    });

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
    // Money already handed over can't disappear with the month.
    const { data: made } = await admin().from("settlement_payments").select("id").eq("settlement_id", settlement.id).limit(1);
    if ((made?.length ?? 0) > 0) return c.json({ error: "Payments have been recorded for this month, so it can't be reopened.", code: "has_payments" }, 400);
    await admin().from("settlements").delete().eq("id", settlement.id);
    return c.json({ ok: true });
  });

  app.post(`${P}/pay`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    if (me.role !== "accountant") return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const { coachId, month } = body;
    const { data: settlement } = await admin().from("settlements").select("*").eq("org_id", me.org_id).eq("coach_id", coachId).eq("month", month).maybeSingle();
    const state = stateOf(settlement);
    if (state !== "settled") return c.json({ error: "Coach isn't ready to pay." }, 400);

    const total = Number(settlement.group_total) + Number(settlement.private_total);
    const paidSoFar = (await paidBySettlementMap([settlement.id])).get(settlement.id) ?? 0;
    const remaining = Math.round((total - paidSoFar) * 100) / 100;
    if (remaining <= 0) return c.json({ error: "Nothing left to pay for this month." }, 400);

    const amount = body.amount === undefined || body.amount === null || body.amount === "" ? remaining : Math.round(Number(body.amount) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return c.json({ error: "Enter an amount to pay." }, 400);
    if (amount > remaining) return c.json({ error: `Only ${remaining} EGP is left to pay for this month.`, code: "over_remaining" }, 400);
    const paidOn = body.date ? String(body.date).slice(0, 10) : gymToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || paidOn > gymToday()) return c.json({ error: "Choose today or an earlier date." }, 400);
    const method = body.method ?? "cash";
    if (!PAY_METHODS.includes(method)) return c.json({ error: "Choose how it was paid." }, 400);
    const note = body.note ? String(body.note).trim().slice(0, 200) || null : null;

    // Atomic in the database: two taps at once can't pay more than what's left.
    const { data: made, error } = await admin().rpc("record_settlement_payment", { p_settlement: settlement.id, p_org: me.org_id, p_amount: amount, p_paid_on: paidOn, p_method: method, p_note: note, p_by: me.id });
    if (error) {
      const over = /over_remaining:([\d.]+)/.exec(error.message ?? "");
      if (over) return c.json({ error: `Only ${Number(over[1])} EGP is left to pay for this month.`, code: "over_remaining" }, 400);
      if (/nothing_left/.test(error.message ?? "")) return c.json({ error: "Nothing left to pay for this month.", code: "nothing_left" }, 400);
      throw error;
    }
    const result = Array.isArray(made) ? made[0] : made;
    const left = Number(result.remaining);
    const { data: payment } = await admin().from("settlement_payments").select("*").eq("id", result.payment_id).single();
    const { data: updated } = await admin().from("settlements").select("*").eq("id", settlement.id).single();

    const coach = await staffInMyOrg(me, coachId);
    if (coach) {
      await sendPushToProfile(me.org_id, coachId, "payment_received", {
        title: "💰 Payment received",
        body: left <= 0 ? `${amount} EGP paid for ${month}. Your month is fully paid.` : `${amount} EGP paid for ${month}. ${left} EGP still to come.`,
        url: homePathForRole(coach.role),
      });
    }
    return c.json({ settlement: toSettlement(updated ?? settlement), payment: toSettlementPayment(payment), paidAmount: total - left, remaining: left });
  });

  app.get(`${P}/pay/payments`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!me) return c.json({ error: "Unauthorized" }, 401);
    const coachId = c.req.query("coachId") ?? me.id;
    const month = c.req.query("month") ?? "";
    if (coachId !== me.id && !["accountant", "dept_head", "head_coach"].includes(me.role)) return c.json({ error: "Forbidden" }, 403);
    const { data: settlement } = await admin().from("settlements").select("id").eq("org_id", me.org_id).eq("coach_id", coachId).eq("month", month).maybeSingle();
    if (!settlement) return c.json({ payments: [] });
    const { data } = await admin().from("settlement_payments").select("*").eq("settlement_id", settlement.id).order("paid_on").order("created_at");
    return c.json({ payments: (data ?? []).map(toSettlementPayment) });
  });

  app.get(`${P}/payment-requests`, async (c) => {
    const me = await soloOwnerOf(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { data, error } = await admin().from("payment_requests").select("*, clients(name, phone)").eq("org_id", me.org_id).eq("status", c.req.query("status") === "done" ? "approved" : "pending").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    const out = await Promise.all((data ?? []).map(async (r: any) => {
      let proofUrl: string | null = null;
      if (r.proof_path) proofUrl = (await admin().storage.from(PROOF_BUCKET).createSignedUrl(r.proof_path, 600)).data?.signedUrl ?? null;
      return { ...toPaymentRequest(r), clientId: r.client_id, clientName: r.clients?.name ?? "Member", clientPhone: r.clients?.phone ?? null, proofUrl };
    }));
    return c.json({ requests: out });
  });

  app.post(`${P}/payment-requests/:id/approve`, async (c) => {
    const me = await soloOwnerOf(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const id = c.req.param("id");
    const { data: req } = await admin().from("payment_requests").select("*").eq("id", id).eq("org_id", me.org_id).maybeSingle();
    if (!req) return c.json({ error: "No such request" }, 404);
    if (req.status !== "pending") return c.json({ error: "That one was already handled." }, 409);
    const { data: client } = await admin().from("clients").select("*").eq("id", req.client_id).maybeSingle();
    if (!client) return c.json({ error: "That member no longer exists." }, 404);

    // Claim it so a double-tap can't sell twice; put it back if the sale fails.
    const { data: claimed } = await admin().from("payment_requests").update({ status: "approved", reviewed_by: me.id, reviewed_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) return c.json({ error: "That one was already handled." }, 409);
    const release = () => admin().from("payment_requests").update({ status: "pending", reviewed_by: null, reviewed_at: null }).eq("id", id);

    if (req.offer_type === "plan_type") {
      const { data: t } = req.plan_type_id ? await admin().from("group_plan_types").select("price").eq("id", req.plan_type_id).maybeSingle() : { data: null };
      if (t && Number(t.price) !== Number(req.price)) { await release(); return c.json({ error: `The price changed from ${req.price} to ${t.price} EGP since this was paid. Reject it and ask them to pay again.` }, 400); }
      const r = await sellGroupPlan({ orgId: me.org_id, client: { id: client.id, name: client.name }, planTypeId: req.plan_type_id, payMethod: "instapay", actorId: me.id });
      if ("error" in r) { await release(); return c.json({ error: r.error }, r.status); }
    } else {
      const { data: b } = req.bundle_type_id ? await admin().from("bundle_types").select("price").eq("id", req.bundle_type_id).maybeSingle() : { data: null };
      if (b && Number(b.price) !== Number(req.price)) { await release(); return c.json({ error: `The price changed from ${req.price} to ${b.price} EGP since this was paid. Reject it and ask them to pay again.` }, 400); }
      if (!req.bundle_type_id) { await release(); return c.json({ error: "That package isn't on sale anymore." }, 404); }
      const r = await sellPackageTo(client.id, req.bundle_type_id, me.id, me, "instapay");
      if ("error" in r) { await release(); return c.json({ error: r.error }, r.status); }
      await earnPurchasePoints(client.id, me.org_id, Number(r.package.price_at_sale), "instapay");
      await logActivity(me.org_id, "sale_package", { actorId: me.id, clientId: client.id, amount: Number(r.package.price_at_sale), meta: { payMethod: "instapay", locationId: r.package.location_id ?? null, requestId: id } });
      await notifyClient(me.org_id, client.id, "payment_approved", { title: `${req.name} is active`, body: `Your payment was approved. ${r.package.sessions_included} sessions are ready to use.`, push: true });
    }
    return c.json({ ok: true });
  });

  app.post(`${P}/payment-requests/:id/reject`, async (c) => {
    const me = await soloOwnerOf(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { note } = await c.req.json().catch(() => ({}));
    const text = String(note ?? "").trim().slice(0, 200) || null;
    const { data: req } = await admin().from("payment_requests").update({ status: "rejected", note: text, reviewed_by: me.id, reviewed_at: new Date().toISOString() }).eq("id", c.req.param("id")).eq("org_id", me.org_id).eq("status", "pending").select("*").maybeSingle();
    if (!req) return c.json({ error: "That one was already handled." }, 409);
    await notifyClient(me.org_id, req.client_id, "payment_rejected", { title: "We couldn't confirm your payment", body: text ? `${req.name}: ${text}` : `${req.name}: please check the receipt and try again.`, push: true });
    return c.json({ ok: true });
  });

  app.get(`${P}/payments/summary`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head" && me?.role !== "accountant") return c.json({ error: "Forbidden" }, 403);
    const nMonths = Math.min(Math.max(Number(c.req.query("months") ?? "1") || 1, 1), 24);
    const months = monthsBack(nMonths);
    const since = `${months[0]}-01T00:00:00Z`;
    // Optional: one location's money only (sales are tagged with their location).
    const locationId = c.req.query("locationId") || null;
    let q = admin()
      .from("activity_log")
      .select("id, type, amount, meta, created_at, clients:subject_client_id(name)")
      .eq("org_id", me.org_id)
      .in("type", ["sale_plan", "sale_package", "sale_dropin", "class_collected"])
      .gte("created_at", since);
    if (locationId) q = q.eq("meta->>locationId", locationId);
    const { data } = await q.order("created_at", { ascending: false }).limit(2000);
    const totals = new Map<string, { amount: number; count: number }>();
    const transfers: any[] = [];
    const perMonth = new Map<string, number>(months.map((m) => [m, 0]));
    for (const a of data ?? []) {
      const raw = String((a.meta as any)?.payMethod ?? "");
      if (raw === "wallet") continue; // store credit is not new money
      const key = raw === "cash" || raw === "card" || raw === "instapay" ? raw : "other";
      const amount = Number(a.amount ?? 0);
      const t = totals.get(key) ?? { amount: 0, count: 0 };
      t.amount += amount;
      t.count += 1;
      totals.set(key, t);
      const month = String(a.created_at).slice(0, 7);
      if (perMonth.has(month)) perMonth.set(month, perMonth.get(month)! + amount);
      if (key === "instapay" && transfers.length < 100) {
        const m = (a.meta as any) ?? {};
        transfers.push({ id: a.id, at: a.created_at, clientName: (a as any).clients?.name ?? null, amount, what: m.name ?? m.title ?? (a.type === "sale_package" ? "PT package" : a.type === "class_collected" ? "Class" : "Sale") });
      }
    }
    const byMethod = ["instapay", "cash", "card", "other"]
      .filter((k) => totals.has(k))
      .map((k) => ({ method: k, label: TENDER_LABELS[k], amount: totals.get(k)!.amount, count: totals.get(k)!.count }));
    return c.json({ months: nMonths, total: byMethod.reduce((a, r) => a + r.amount, 0), byMethod, transfers, byMonth: [...perMonth].map(([month, revenue]) => ({ month, revenue })) });
  });

}

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

// Phase 3 slice: desk
export function register(app: Hono) {
  app.post(`${P}/clients/location`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const loc = await locationField(me.org_id, body.locationId ?? null);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const { data, error } = await admin().from("clients").update({ home_location_id: loc.id ?? null }).eq("id", String(body.id ?? "")).eq("org_id", me.org_id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return c.json({ error: "No such client" }, 404);
    return c.json({ ok: true, homeLocationId: loc.id ?? null });
  });

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
    const { data: ended } = await admin().from("group_plans").select("*").eq("org_id", me.org_id).eq("status", "finished")
      .gte("expires_at", new Date(Date.now() - 90 * 86400000).toISOString()).order("expires_at", { ascending: false });
    const endedByClient = new Map<string, any>();
    for (const p of ended ?? []) if (!endedByClient.has(p.client_id)) endedByClient.set(p.client_id, p);
    const rows = await Promise.all(
      (clients ?? []).map(async (cl) => {
        const [pkg, membership, conditions] = await Promise.all([
          currentPackageForClient(cl.id, me.org_id),
          currentMembershipForClient(cl.id, me.org_id),
          canSeeConditions ? conditionsOf(cl.id) : Promise.resolve(null),
        ]);
        const plan = planByClient.get(cl.id);
        return { ...toClient(cl, conditions, pkg ? toPackageInstance(pkg) : null, membership ? toMembershipInstance(membership) : null), groupPlan: plan ? toGroupPlan(plan) : null, lastGroupPlan: !plan && endedByClient.has(cl.id) ? toGroupPlan(endedByClient.get(cl.id)) : null };
      }),
    );
    return c.json({ clients: rows });
  });

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
    await logActivity(me.org_id, "sale_package", { actorId: me.id, clientId: result.client.id, amount: Number(result.package.price_at_sale), meta: { payMethod, locationId: result.package.location_id ?? null } });
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
    await logActivity(me.org_id, "sale_package", { actorId: me.id, clientId, amount: price, meta: { payMethod, locationId: result.package.location_id ?? null } });
    return c.json({ package: toPackageInstance(result.package) });
  });

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

  app.get(`${P}/front-desk/client-status/:id`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!(await isDeskStaff(me))) return c.json({ error: "Forbidden" }, 403);
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
    if (!(await isDeskStaff(me))) return c.json({ error: "Forbidden" }, 403);
    const { clientId, source, locationId } = await c.req.json();
    if (source !== "qr" && source !== "manual") return c.json({ error: "Invalid check-in source." }, 400);
    const { data: client } = await admin().from("clients").select("id, name").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
    if (!client) return c.json({ error: "No such client" }, 404);
    const loc = await locationField(me.org_id, locationId);
    if ("error" in loc) return c.json({ error: loc.error }, 400);
    const r = await recordCheckIn(me.org_id, clientId, client.name, source, me.id, false, loc.id ?? null);
    if (!r.ok) return c.json({ error: r.error, code: r.code ?? null, plan: r.plan ?? null }, r.status as any);
    const data = r.checkIn;
    return c.json({ checkIn: { id: data.id, clientId: data.client_id, source: data.source, checkedInAt: data.checked_in_at }, deducted: r.deducted, plan: r.plan });
  });

  app.post(`${P}/drop-ins`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!(await isDeskStaff(me))) return c.json({ error: "Forbidden" }, 403);
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
          pay_method: payMethod === "wallet" ? "wallet" : "desk", pay_status: "paid", attendance: "arrived", price_egp: amount, credit_spent: false, booked_at: new Date().toISOString(),
        },
        { onConflict: "class_id,client_id" },
      );
      if (bErr) {
        // The seat couldn't be written (e.g. the session was just removed by a
        // schedule edit) — undo the sale so no money is taken without a seat.
        await admin().from("drop_ins").delete().eq("id", data.id);
        await undoNewClient();
        if (payMethod === "wallet") await creditWallet(clientId, me.org_id, amount, "refund", `Refund: ${cat} drop-in not completed`, me.id);
        return c.json({ error: "That class session is no longer available — nothing was charged." }, 409);
      }
    }
    await earnPurchasePoints(data.client_id, me.org_id, amount, payMethod);
    await logActivity(me.org_id, "sale_dropin", { actorId: me.id, clientId: data.client_id, amount, meta: { payMethod, classId: cls?.id ?? null, title: cat, locationId: cls?.location_id ?? null } });
    return c.json({ dropIn: { id: data.id, clientId: data.client_id, classId: data.class_id ?? null, category: data.category, price: Number(data.price), createdAt: data.created_at }, newClientId: createdClientId });
  });

  app.post(`${P}/invitations`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!(await isDeskStaff(me))) return c.json({ error: "Forbidden" }, 403);
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

  app.get(`${P}/front-desk/summary`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!(await isDeskStaff(me))) return c.json({ error: "Forbidden" }, 403);
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

  app.post(`${P}/scan`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    // A solo owner is her own trainer, so she scans PT codes too (no coaches' room).
    const soloOwner = me?.role === "dept_head" && (await orgModeOf(me.org_id)) === "solo";
    if (!me || (me.role !== "coach" && me.role !== "head_coach" && !soloOwner)) return c.json({ error: "Forbidden" }, 403);
    const token = String((await c.req.json().catch(() => ({}))).token ?? "").trim();
    const { data: org } = await admin().from("organizations").select("id, slug, coach_qr_token").eq("id", me.org_id).maybeSingle();
    if (soloOwner && token && token === org?.coach_qr_token) return c.json({ error: "That's the coaches' QR — scan a member's PT code instead." }, 400);
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
    const { qrToken, packageId } = await c.req.json();
    let r: { pkg: any } | { error: string; status: number };
    if (!qrToken && packageId && me.role === "dept_head" && (await orgModeOf(me.org_id)) === "solo") {
      const { data: row } = await admin().from("package_instances").select("qr_token").eq("id", String(packageId)).eq("org_id", me.org_id).maybeSingle();
      if (!row?.qr_token) return c.json({ error: "No such PT bundle." }, 404);
      r = await resolvePtScan(me, String(row.qr_token));
    } else {
      if (!qrToken) return c.json({ error: "Scan the member's PT code to log the session.", code: "scan_required" }, 400);
      r = await resolvePtScan(me, String(qrToken));
    }
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

    await admin().from("delivery_logs").insert({ org_id: me.org_id, package_instance_id: pkg.id, date: gymToday(), logged_by: me.id, source: qrToken ? "qr" : "manual" });

    await notifyClient(me.org_id, pkg.client_id, "pt_logged", {
      title: "PT session logged",
      body: sessionsRemaining > 0
        ? `${me.name} logged today's session · ${sessionsRemaining} of ${updated.sessions_included} left.`
        : `${me.name} logged your last PT session. Ask the desk about renewing.`,
      push: true,
    });
    return c.json({ package: toPackageInstance(updated), preview: await ptScanPreview(updated) });
  });

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

  app.post(`${P}/group-plans/sell`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (!(await isDeskStaff(me))) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const { clientId, name, age, phone, email, planTypeId, seriesId } = body;
    const payMethod = normPayMethod(body.payMethod);
    if (payMethod === "wallet" && !clientId) return c.json({ error: "A brand-new client has no wallet balance yet — take cash or card." }, 400);
    if (!planTypeId && !seriesId) return c.json({ error: "Choose a plan." }, 400);

    // Finds the client being sold to, or creates them in the same step.
    const made: string[] = [];
    const resolveClient = async (spec: { clientId?: string; name?: string; age?: unknown; phone?: unknown; email?: unknown }) => {
      if (spec.clientId) {
        const { data } = await admin().from("clients").select("*").eq("id", spec.clientId).eq("org_id", me.org_id).maybeSingle();
        return data ? { client: data } : { error: "No such client", status: 404 };
      }
      if (!spec.name || !String(spec.name).trim()) return { error: "Name is required.", status: 400 };
      const limitErr = await planLimitError(me.org_id, "client");
      if (limitErr) return { error: limitErr, status: 400 };
      const created = await insertClient(me, { name: spec.name, age: spec.age, phone: spec.phone, email: spec.email });
      made.push(created.id);
      return { client: created };
    };
    const undoCreated = () => Promise.all(made.map((id) => admin().from("clients").delete().eq("id", id)));

    const first = await resolveClient({ clientId, name, age, phone, email });
    if ("error" in first) return c.json({ error: first.error }, first.status as 400);
    const client = first.client;

    // A shared bundle goes to several clients at once, one plan each.
    let sharedType: any = null;
    if (planTypeId) {
      const { data: t } = await admin().from("group_plan_types").select("*").eq("id", planTypeId).eq("org_id", me.org_id).maybeSingle();
      if (t?.shared_seats) sharedType = t;
    }
    if (sharedType) {
      const partners: any[] = Array.isArray(body.partners) ? body.partners : [];
      const need = Number(sharedType.shared_seats) - 1;
      if (payMethod === "wallet") { await undoCreated(); return c.json({ error: "A shared bundle is paid at the desk — cash, card or InstaPay.", code: "shared_wallet" }, 400); }
      if (partners.length !== need) { await undoCreated(); return c.json({ error: `${sharedType.name} is shared by ${sharedType.shared_seats} clients — add ${need === 1 ? "the other client" : `${need} more clients`}.`, code: "shared_partners" }, 400); }
      const sharing = [client];
      for (const spec of partners) {
        const r = await resolveClient(spec ?? {});
        if ("error" in r) { await undoCreated(); return c.json({ error: r.error }, r.status as 400); }
        if (sharing.some((x) => x.id === r.client.id)) { await undoCreated(); return c.json({ error: "Each person can only share once — pick someone else.", code: "shared_same" }, 400); }
        sharing.push(r.client);
      }
      // Check everyone up front so a sale doesn't half-happen.
      for (const person of sharing) {
        const current = await activeGroupPlan(person.id, me.org_id);
        if (current) {
          await undoCreated();
          return c.json({ error: `${person.name} already has an active plan: ${planSummary(current)}. A new one can be bought once it's finished.`, code: "active_plan", activePlan: toGroupPlan(current) }, 400);
        }
      }
      const shareGroupId = crypto.randomUUID();
      const sold: any[] = [];
      try {
        for (const person of sharing) {
          const r = await sellGroupPlan({ orgId: me.org_id, client: person, planTypeId, payMethod, actorId: me.id, shareGroupId });
          if ("error" in r) throw Object.assign(new Error(r.error), { sale: r });
          sold.push(r.plan);
        }
      } catch (err: any) {
        for (const plan of sold) await admin().from("group_plans").delete().eq("id", plan.id);
        await undoCreated();
        if (err?.sale) return c.json({ error: err.sale.error, code: err.sale.code ?? null }, err.sale.status);
        throw err;
      }
      return c.json({ client: { ...toClient(client, null, null), groupPlan: toGroupPlan(sold[0]) }, plan: toGroupPlan(sold[0]), sharedWith: sharing.slice(1).map((x, i) => ({ id: x.id, name: x.name, plan: toGroupPlan(sold[i + 1]) })) });
    }

    let result;
    try {
      result = await sellGroupPlan({ orgId: me.org_id, client, planTypeId, seriesId, payMethod, actorId: me.id });
    } catch (err) {
      await undoCreated();
      throw err;
    }
    if ("error" in result) {
      await undoCreated();
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

  app.post(`${P}/clients/import`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head" && !(await isDeskStaff(me))) return c.json({ error: "Forbidden" }, 403);
    const { rows } = await c.req.json();
    if (!Array.isArray(rows) || rows.length === 0) return c.json({ error: "Nothing to import." }, 400);
    if (rows.length > 500) return c.json({ error: "Import up to 500 members at a time." }, 400);
    const isDate = (v: any) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
    const { data: existing } = await admin().from("clients").select("phone").eq("org_id", me.org_id);
    const phones = new Set((existing ?? []).map((r: any) => String(r.phone ?? "").replace(/\s/g, "")).filter(Boolean));
    const result = { imported: 0, skipped: [] as { row: number; reason: string }[] };
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? {};
      const name = String(r.name ?? "").trim();
      const phone = String(r.phone ?? "").replace(/\s/g, "");
      if (!name) { result.skipped.push({ row: i + 1, reason: "No name" }); continue; }
      if (phone && phones.has(phone)) { result.skipped.push({ row: i + 1, reason: "Already a client (same phone)" }); continue; }
      const hasPlan = isDate(r.expiresOn);
      if (r.expiresOn && !hasPlan) { result.skipped.push({ row: i + 1, reason: "Expiry date must look like 2026-11-30" }); continue; }
      const limitErr = await planLimitError(me.org_id, "client");
      if (limitErr) { result.skipped.push({ row: i + 1, reason: limitErr }); break; }
      const client = await insertClient(me, { name, phone: phone || null, email: r.email });
      if (phone) phones.add(phone);
      if (hasPlan) {
        const left = r.creditsLeft === undefined || r.creditsLeft === null || r.creditsLeft === "" ? null : Number(r.creditsLeft);
        const total = r.creditsTotal === undefined || r.creditsTotal === null || r.creditsTotal === "" ? left : Number(r.creditsTotal);
        const isBundle = left !== null && Number.isFinite(left);
        const startsOn = isDate(r.startsOn) ? r.startsOn : todayIso();
        const endsAt = new Date(`${r.expiresOn}T23:59:59Z`);
        const live = endsAt.getTime() > Date.now() && (!isBundle || (left as number) > 0);
        const { error } = await admin().from("group_plans").insert({
          org_id: me.org_id, client_id: client.id, kind: isBundle ? "bundle" : "membership",
          name: String(r.plan ?? "").trim() || (isBundle ? "Class pack" : "Membership"), price_at_sale: 0, pay_method: "cash",
          credits_total: isBundle ? Math.max(Number(total ?? 0), left as number) : null, credits_remaining: isBundle ? left : null,
          invitations_remaining: 0, starts_at: `${startsOn}T00:00:00Z`, expires_at: endsAt.toISOString(),
          status: live ? "active" : "finished", created_by: me.id,
        });
        if (error) { result.skipped.push({ row: i + 1, reason: `Client added, but the plan couldn't be saved: ${error.message}` }); }
      }
      result.imported += 1;
    }
    await logActivity(me.org_id, "members_imported", { actorId: me.id, amount: result.imported, meta: { skipped: result.skipped.length } });
    return c.json(result);
  });

  app.get(`${P}/revenue`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head" && me?.role !== "accountant") return c.json({ error: "Forbidden" }, 403);
    const org = me.org_id;
    const nMonths = Math.min(Math.max(Number(c.req.query("months") ?? "6") || 6, 1), 24);
    // `history` (optional) also returns the month-by-month series for a longer
    // window in the same call, so the overview needs one request, not two.
    const nHistory = Math.min(Math.max(Number(c.req.query("history") ?? "0") || 0, nMonths), 24);
    const months = monthsBack(nHistory); // oldest first; the last nMonths are the report's range
    const shown = months.slice(-nMonths);
    const since = `${months[0]}-01T00:00:00Z`;
    await sweepOrgGroupPlans(org);

    const [sales, coaches, activePkgs, activePlans, lots] = await Promise.all([
      salesInRange(org, since),
      admin().from("profiles").select("*").eq("org_id", org).in("role", ["coach", "head_coach", "dept_head"]),
      admin().from("package_instances").select("client_id").eq("org_id", org).eq("status", "active").gte("expires_at", `${todayIso()}T00:00:00Z`),
      admin().from("group_plans").select("client_id, kind").eq("org_id", org).eq("status", "active"),
      admin().from("wallet_transactions").select("remaining").eq("org_id", org).eq("type", "credit").gt("remaining", 0).gt("expires_at", new Date().toISOString()),
    ]);

    const inRange = new Set(shown);
    const kept = sales.filter((s) => inRange.has(s.month));

    // Coach payouts per month, from the same rollup the payout screens use.
    const rollups = await monthRollupsMany(org, coaches.data ?? [], months);
    const payoutRows = months.map((m) => rollups.get(m) ?? []);
    const payoutByMonth = new Map(months.map((m, i) => [m, payoutRows[i].reduce((s: number, r: any) => s + r.total, 0)]));
    const payoutByCoach = new Map<string, number>();
    for (const rows of payoutRows.slice(-nMonths)) for (const r of rows) payoutByCoach.set(r.coachId, (payoutByCoach.get(r.coachId) ?? 0) + r.total);

    const series = months.map((m) => {
      const revenue = sales.filter((s) => s.month === m).reduce((a, s) => a + s.amount, 0);
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

    const totalRevenue = series.slice(-nMonths).reduce((a, s) => a + s.revenue, 0);
    const totalPayouts = series.slice(-nMonths).reduce((a, s) => a + s.payouts, 0);
    return c.json({
      months: series.slice(-nMonths),
      history: series,
      totals: { revenue: totalRevenue, payouts: totalPayouts, profit: totalRevenue - totalPayouts },
      byService,
      byType,
      byCoach,
      activeSubscribers: { total: new Set([...groupSubs, ...ptSubs]).size, groupPlans: groupSubs.size, ptPackages: ptSubs.size, byPlanKind: planKinds },
      walletLiability: (lots.data ?? []).reduce((a: number, l: any) => a + Number(l.remaining), 0),
    });
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
    const { data: bookedClass } = await admin().from("classes").select("location_id").eq("id", b.class_id).maybeSingle();
    await logActivity(me.org_id, "class_collected", { actorId: me.id, clientId: b.client_id, amount: price, meta: { bookingId, payMethod, locationId: bookedClass?.location_id ?? null } });
    return c.json({ ok: true });
  });

  app.post(`${P}/clients/refund`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
    const { clientId, amount, destination, note } = await c.req.json();
    const amt = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(amt) || amt <= 0) return c.json({ error: "Enter a refund amount." }, 400);
    if (destination !== "wallet" && destination !== "desk") return c.json({ error: "Choose where the refund goes." }, 400);
    const { data: client } = await admin().from("clients").select("id, name, home_location_id").eq("id", clientId).eq("org_id", me.org_id).maybeSingle();
    if (!client) return c.json({ error: "No such client" }, 404);
    const { paid, refunded, refundable } = await refundableFor(clientId, me.org_id);
    if (amt > refundable) {
      return c.json({
        error: refundable > 0
          ? `A refund can't be more than what ${client.name} paid. They can be refunded up to ${refundable} EGP (${paid} paid, ${refunded} already refunded).`
          : `${client.name} has nothing left to refund (${paid} paid, ${refunded} already refunded).`,
        code: "refund_too_large", refundable,
      }, 400);
    }
    await clawbackPoints(clientId, me.org_id, amt);
    if (destination === "wallet") {
      const balance = await creditWallet(clientId, me.org_id, amt, "refund", note ? String(note) : "Refund to wallet", me.id, { locationId: client.home_location_id ?? null });
      await notifyClient(me.org_id, clientId, "wallet_refund", { title: `${amt} EGP refunded to your wallet`, body: note ? String(note) : "You can use it for classes and plans.", push: true });
      return c.json({ ok: true, walletBalance: balance });
    }
    // "At desk": the real money (cash / card / Stripe) is handled outside Bizqwik;
    // we only record the equivalent for the log.
    await logActivity(me.org_id, "refund_desk", { actorId: me.id, clientId, amount: amt, meta: { note: note ?? null, locationId: client.home_location_id ?? null } });
    return c.json({ ok: true });
  });

  app.get(`${P}/clients/refundable/:id`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head" && me?.role !== "front_desk") return c.json({ error: "Forbidden" }, 403);
    const id = c.req.param("id");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: "No such client" }, 404);
    const { data: client } = await admin().from("clients").select("id").eq("id", id).eq("org_id", me.org_id).maybeSingle();
    if (!client) return c.json({ error: "No such client" }, 404);
    return c.json(await refundableFor(id, me.org_id));
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
    const balance = await creditWallet(clientId, me.org_id, amt, "compensation", note ? String(note) : "Compensation credit", me.id);
    await notifyClient(me.org_id, clientId, "wallet_credit", { title: `${amt} EGP added to your wallet`, body: note ? String(note) : "A little something from the gym.", push: true });
    return c.json({ ok: true, walletBalance: balance });
  });

  app.get(`${P}/activity`, async (c) => {
    const user = await requireUser(c);
    const me = user && (await profileOf(user.id));
    if (me?.role !== "dept_head" && me?.role !== "front_desk" && me?.role !== "accountant") return c.json({ error: "Forbidden" }, 403);
    const limit = Math.min(Number(c.req.query("limit") ?? "100") || 100, 300);
    const { data } = await admin().from("activity_log").select("*, clients:subject_client_id(name)").eq("org_id", me.org_id).order("created_at", { ascending: false }).limit(limit);
    // Who did it, when a staff member did (members' own actions have no actor).
    const actorIds = [...new Set((data ?? []).map((a: any) => a.actor_id).filter(Boolean))];
    const { data: actors } = actorIds.length ? await admin().from("profiles").select("id, name").in("id", actorIds) : { data: [] as any[] };
    const actorName = new Map((actors ?? []).map((p: any) => [p.id, p.name]));
    return c.json({ activity: (data ?? []).map((a: any) => ({ id: a.id, type: a.type, amount: a.amount != null ? Number(a.amount) : null, clientName: a.clients?.name ?? null, actorName: a.actor_id ? (actorName.get(a.actor_id) ?? null) : null, meta: a.meta, at: a.created_at })) });
  });

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

}

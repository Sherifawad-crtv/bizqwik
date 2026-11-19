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

// Phase 3 slice: accounting
export function register(app: Hono) {
  app.get(`${P}/accounting/categories`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { data } = await admin().from("expense_categories").select("*").eq("org_id", me.org_id).is("archived_at", null).order("sort_order");
    return c.json({ categories: (data ?? []).map(toExpenseCategory) });
  });

  app.post(`${P}/accounting/categories`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { name } = await c.req.json();
    const n = String(name ?? "").trim();
    if (!n) return c.json({ error: "Name is required." }, 400);
    const { count } = await admin().from("expense_categories").select("id", { count: "exact", head: true }).eq("org_id", me.org_id);
    const { data, error } = await admin().from("expense_categories").insert({ org_id: me.org_id, name: n, sort_order: (count ?? 0) + 1 }).select().single();
    if (error) return c.json({ error: error.code === "23505" ? "A category with that name already exists." : error.message }, 400);
    return c.json({ category: toExpenseCategory(data) });
  });

  app.post(`${P}/accounting/categories/update`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { id, name, archived } = await c.req.json();
    const updates: Record<string, unknown> = {};
    if (name !== undefined) {
      const n = String(name).trim();
      if (!n) return c.json({ error: "Name is required." }, 400);
      updates.name = n;
    }
    // A category with expenses on it is kept, never hard-deleted — archiving
    // just takes it out of the picker; its past expenses keep their name.
    if (archived !== undefined) updates.archived_at = archived ? new Date().toISOString() : null;
    const { data, error } = await admin().from("expense_categories").update(updates).eq("id", id).eq("org_id", me.org_id).select().maybeSingle();
    if (error) return c.json({ error: error.code === "23505" ? "A category with that name already exists." : error.message }, 400);
    if (!data) return c.json({ error: "No such category" }, 404);
    return c.json({ category: toExpenseCategory(data) });
  });

  app.get(`${P}/accounting/expenses`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const month = c.req.query("month") || expenseMonthNow();
    const [{ data: rows }, names] = await Promise.all([
      admin().from("expenses").select("*").eq("org_id", me.org_id).is("deleted_at", null)
        .gte("expense_date", `${month}-01`).lt("expense_date", addMonthsIso(`${month}-01`, 1)).order("expense_date", { ascending: false }),
      categoryNames(me.org_id),
    ]);
    const expenses = await Promise.all((rows ?? []).map(async (r: any) => {
      const url = r.receipt_path ? (await admin().storage.from(EXPENSE_RECEIPT_BUCKET).createSignedUrl(r.receipt_path, 600)).data?.signedUrl ?? null : null;
      return toExpense(r, names.get(r.category_id) ?? "Other", url);
    }));
    return c.json({ expenses });
  });

  app.post(`${P}/accounting/expenses`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const body = await c.req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return c.json({ error: "Enter an amount." }, 400);
    const date = String(body.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return c.json({ error: "Pick a valid date." }, 400);
    const names = await categoryNames(me.org_id);
    if (!names.has(body.categoryId)) return c.json({ error: "Choose a category." }, 400);

    let receiptPath: string | null = null;
    if (body.receipt) {
      const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(String(body.receipt));
      if (!m) return c.json({ error: "That receipt photo didn't come through — try again." }, 400);
      const bytes = Uint8Array.from(atob(m[3]), (ch) => ch.charCodeAt(0));
      if (bytes.length > 2_500_000) return c.json({ error: "That image is too large. Try a smaller photo." }, 400);
      receiptPath = `${me.org_id}/${crypto.randomUUID()}.${m[2] === "jpeg" ? "jpg" : m[2]}`;
      const up = await admin().storage.from(EXPENSE_RECEIPT_BUCKET).upload(receiptPath, bytes, { contentType: m[1] });
      if (up.error) return c.json({ error: "Couldn't upload the receipt. Please try again." }, 500);
    }

    const { data, error } = await admin().from("expenses").insert({
      org_id: me.org_id, category_id: body.categoryId, amount, expense_date: date,
      note: body.note ? String(body.note).trim() : null, receipt_path: receiptPath, created_by: me.id,
    }).select().single();
    if (error) throw error;
    const categoryName = names.get(data.category_id) ?? "Other";
    await logActivity(me.org_id, "expense_added", { actorId: me.id, amount, meta: { expenseId: data.id, category: categoryName } });
    const url = receiptPath ? (await admin().storage.from(EXPENSE_RECEIPT_BUCKET).createSignedUrl(receiptPath, 600)).data?.signedUrl ?? null : null;
    return c.json({ expense: toExpense(data, categoryName, url) });
  });

  app.post(`${P}/accounting/expenses/update`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { id, amount, categoryId, date, note } = await c.req.json();
    const { data: existing } = await admin().from("expenses").select("*").eq("id", id).eq("org_id", me.org_id).is("deleted_at", null).maybeSingle();
    if (!existing) return c.json({ error: "No such expense" }, 404);
    // A recurring row stays attached to its template, but it's its own row from
    // here on — editing it never rewrites the template, and the template never
    // overwrites it back.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return c.json({ error: "Enter an amount." }, 400);
      updates.amount = n;
    }
    if (categoryId !== undefined) {
      const { data: cat } = await admin().from("expense_categories").select("id").eq("id", categoryId).eq("org_id", me.org_id).maybeSingle();
      if (!cat) return c.json({ error: "Choose a category." }, 400);
      updates.category_id = categoryId;
    }
    if (date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return c.json({ error: "Pick a valid date." }, 400);
      updates.expense_date = date;
    }
    if (note !== undefined) updates.note = note ? String(note).trim() : null;
    const { data, error } = await admin().from("expenses").update(updates).eq("id", id).select().single();
    if (error) throw error;
    await logActivity(me.org_id, "expense_edited", { actorId: me.id, amount: Number(data.amount), meta: { expenseId: id } });
    const [url, names] = await Promise.all([
      data.receipt_path ? admin().storage.from(EXPENSE_RECEIPT_BUCKET).createSignedUrl(data.receipt_path, 600).then((r) => r.data?.signedUrl ?? null) : Promise.resolve(null),
      categoryNames(me.org_id),
    ]);
    return c.json({ expense: toExpense(data, names.get(data.category_id) ?? "Other", url) });
  });

  app.post(`${P}/accounting/expenses/delete`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { id } = await c.req.json();
    const { data: existing } = await admin().from("expenses").select("amount").eq("id", id).eq("org_id", me.org_id).is("deleted_at", null).maybeSingle();
    if (!existing) return c.json({ error: "No such expense" }, 404);
    await admin().from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    await logActivity(me.org_id, "expense_deleted", { actorId: me.id, amount: existing.amount, meta: { expenseId: id } });
    return c.json({ ok: true });
  });

  app.get(`${P}/accounting/recurring`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const [{ data: rows }, names] = await Promise.all([
      admin().from("recurring_expenses").select("*").eq("org_id", me.org_id).order("created_at", { ascending: false }),
      categoryNames(me.org_id),
    ]);
    return c.json({ recurring: (rows ?? []).map((r: any) => toRecurringExpense(r, names.get(r.category_id) ?? "Other")) });
  });

  app.post(`${P}/accounting/recurring`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { categoryId, amount, note, dayOfMonth, endMonth } = await c.req.json();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return c.json({ error: "Enter an amount." }, 400);
    const day = Number(dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 28) return c.json({ error: "Pick a day between 1 and 28." }, 400);
    const names = await categoryNames(me.org_id);
    if (!names.has(categoryId)) return c.json({ error: "Choose a category." }, 400);
    const startMonth = expenseMonthNow();
    const { data, error } = await admin().from("recurring_expenses").insert({
      org_id: me.org_id, category_id: categoryId, amount: amt, note: note ? String(note).trim() : null,
      day_of_month: day, start_month: startMonth, end_month: endMonth || null, created_by: me.id,
    }).select().single();
    if (error) throw error;
    // This month's row is created right away (not left for tonight's job) so
    // the template visibly does something the moment it's saved.
    await generateRecurringRow(data, startMonth);
    return c.json({ recurring: toRecurringExpense(data, names.get(data.category_id) ?? "Other") });
  });

  app.post(`${P}/accounting/recurring/update`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { id, active, amount, categoryId, note, dayOfMonth, endMonth } = await c.req.json();
    const { data: existing } = await admin().from("recurring_expenses").select("id").eq("id", id).eq("org_id", me.org_id).maybeSingle();
    if (!existing) return c.json({ error: "No such template" }, 404);
    // Editing a template only ever changes future months — rows already made
    // for past or the current month are untouched (spec section 4).
    const updates: Record<string, unknown> = {};
    if (active !== undefined) updates.active = !!active;
    if (amount !== undefined) {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) return c.json({ error: "Enter an amount." }, 400);
      updates.amount = n;
    }
    if (categoryId !== undefined) updates.category_id = categoryId;
    if (note !== undefined) updates.note = note ? String(note).trim() : null;
    if (dayOfMonth !== undefined) {
      const day = Number(dayOfMonth);
      if (!Number.isInteger(day) || day < 1 || day > 28) return c.json({ error: "Pick a day between 1 and 28." }, 400);
      updates.day_of_month = day;
    }
    if (endMonth !== undefined) updates.end_month = endMonth || null;
    const { data, error } = await admin().from("recurring_expenses").update(updates).eq("id", id).select().single();
    if (error) throw error;
    return c.json({ recurring: toRecurringExpense(data, (await categoryNames(me.org_id)).get(data.category_id) ?? "Other") });
  });

  app.post(`${P}/accounting/recurring/delete`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const { id } = await c.req.json();
    // Deleting the template never touches expense rows it already made (spec
    // section 7) — it just stops making new ones.
    await admin().from("recurring_expenses").delete().eq("id", id).eq("org_id", me.org_id);
    return c.json({ ok: true });
  });

  app.post(`${P}/accounting/run-recurring`, async (c) => {
    const provided = c.req.header("x-cron-secret") || "";
    const expected = await getSecret("cron_secret");
    if (provided !== expected) return c.json({ error: "Forbidden" }, 403);
    const thisMonth = expenseMonthNow();
    const { data: templates } = await admin().from("recurring_expenses").select("*").eq("active", true);
    let made = 0;
    for (const t of templates ?? []) {
      const through = t.end_month && t.end_month < thisMonth ? t.end_month : thisMonth;
      for (const m of monthRange(t.start_month, addMonthsIso(`${through}-01`, 1).slice(0, 7))) {
        await generateRecurringRow(t, m);
        made++;
      }
    }
    return c.json({ checked: (templates ?? []).length, attempted: made });
  });

  app.get(`${P}/accounting/pnl`, async (c) => {
    const me = await requireAccountingStaff(c);
    if (!me) return c.json({ error: "Forbidden" }, 403);
    const org = me.org_id;
    const month = c.req.query("month") || expenseMonthNow();
    // The trend is the 6 months up to and including the chosen one.
    const trendMonths = monthRange(addMonthsIso(`${month}-01`, -5).slice(0, 7), addMonthsIso(`${month}-01`, 1).slice(0, 7));
    const since = `${trendMonths[0]}-01T00:00:00Z`;

    const [sales, refunds, settlements, otherRows, names, coaches] = await Promise.all([
      salesInRange(org, since),
      refundsInRange(org, since),
      admin().from("settlements").select("coach_id, month, group_total, private_total").eq("org_id", org).in("month", trendMonths),
      admin().from("expenses").select("*").eq("org_id", org).is("deleted_at", null).gte("expense_date", `${trendMonths[0]}-01`).lt("expense_date", addMonthsIso(`${trendMonths[trendMonths.length - 1]}-01`, 1)),
      categoryNames(org),
      // Full rows, not just id/name — monthRollups needs tier_id etc. to compute each coach's rate.
      admin().from("profiles").select("*").eq("org_id", org).in("role", ["coach", "head_coach", "dept_head"]),
    ]);

    const sumByMonth = <T,>(rows: T[], month: (r: T) => string, amount: (r: T) => number) => {
      const out = new Map<string, number>();
      for (const r of rows) out.set(month(r), (out.get(month(r)) ?? 0) + amount(r));
      return out;
    };
    const revenueByMonth = sumByMonth(sales, (s) => s.month, (s) => s.amount);
    const refundsByMonth = sumByMonth(refunds, (r) => r.month, (r) => r.amount);
    const payoutsByMonth = sumByMonth(settlements.data ?? [], (s: any) => s.month, (s: any) => Number(s.group_total ?? 0) + Number(s.private_total ?? 0));
    const otherByMonth = sumByMonth(otherRows.data ?? [], (e: any) => e.expense_date.slice(0, 7), (e: any) => Number(e.amount));

    const trend = trendMonths.map((m) => {
      const gross = revenueByMonth.get(m) ?? 0;
      const refund = refundsByMonth.get(m) ?? 0;
      const net = gross - refund;
      const payouts = payoutsByMonth.get(m) ?? 0;
      const other = otherByMonth.get(m) ?? 0;
      return { month: m, grossRevenue: gross, refunds: refund, netRevenue: net, coachPayouts: payouts, otherExpenses: other, totalExpenses: payouts + other, profit: net - payouts - other };
    });
    const current = trend[trend.length - 1];

    // Who's logged sessions this month but hasn't settled — the P&L's coach
    // payouts are settled-only, so this is the gap: real pay this figure
    // doesn't see yet.
    const rollups = await monthRollups(org, coaches.data ?? [], month);
    const unsettled = rollups.filter((r) => r.state === "logging" && r.count > 0);
    const payoutsPaid = rollups.reduce((sum: number, r: any) => sum + Number(r.paidAmount ?? 0), 0);

    // "Where it went": coach payouts first, then categories, largest first (spec section 6).
    const byCategory = new Map<string, { categoryId: string; name: string; amount: number }>();
    for (const e of otherRows.data ?? []) {
      if (e.expense_date.slice(0, 7) !== month) continue;
      const k = e.category_id;
      const row = byCategory.get(k) ?? { categoryId: k, name: names.get(k) ?? "Other", amount: 0 };
      row.amount += Number(e.amount);
      byCategory.set(k, row);
    }
    const expensesBySource: { key: string; label: string; amount: number; paid?: number }[] = [];
    if (current.coachPayouts > 0) expensesBySource.push({ key: "coach_payouts", label: "Coach payouts", amount: current.coachPayouts, paid: Math.min(current.coachPayouts, payoutsPaid) });
    for (const row of [...byCategory.values()].sort((a, b) => b.amount - a.amount)) expensesBySource.push({ key: row.categoryId, label: row.name, amount: row.amount });

    // "Where it came from": same service split Oversight already shows (group vs
    // private training), for the chosen month only — not a new breakdown.
    const monthSales = sales.filter((s) => s.month === month);
    const bySvc = new Map<string, number>();
    for (const s of monthSales) bySvc.set(s.service, (bySvc.get(s.service) ?? 0) + s.amount);
    const revenueBySource = [...bySvc.entries()]
      .map(([key, amount]) => ({ key, label: key === "group" ? "Group training" : "Private training", amount }))
      .sort((a, b) => b.amount - a.amount);

    return c.json({
      month,
      current,
      trend,
      revenueBySource,
      expensesBySource,
      hasPastExpenses: (otherRows.data ?? []).length > 0 || (settlements.data ?? []).length > 0 || sales.length > 0,
      unsettledNote: unsettled.length > 0 ? { count: unsettled.length } : null,
    });
  });

}

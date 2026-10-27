// Real backend — talks to the "make-server-980e1cbf" Supabase edge function.
// Same auth/api/MOCK shape as the mock layer this replaced, so no screen
// needed to change: swap this one file to point elsewhere and everything
// keeps working (see supabaseClient.ts for which project it targets).
import { FN_SLUG, supabase } from "./supabaseClient";
import { bump } from "./bus";
import { cleanPath, reportError, track } from "./analytics";
import type { PaymentsSummary, Location,
  ActivityEntry,
  BizqwikRole,
  ClassBooking,
  BizqwikTeam,
  BizqwikTeamInvite,
  BundleType,
  ExpenseCategory,
  Expense,
  RecurringExpense,
  PnlReport,
  ClassSeries,
  Client,
  ClientWithPackage,
  CoachOption,
  FrontDeskSummary,
  GroupPlan,
  GroupPlanType,
  GroupPlanTypeKind,
  GymClass,
  Invite,
  OpsSummary,
  OrgBrandingConfig,
  OrgConfig,
  OrgPointsSettings,
  OrgDetail,
  OrgStatus,
  OrgSummary,
  PackageInstance,
  PackageWithNames,
  PayMethod,
  PlanType,
  Profile,
  RevenueReport,
  Role,
  Rollup,
  Session,
  ScanResult,
  PtScanPreview,
  Tier,
} from "./types";

/** One kind of drop-in at a location (e.g. Kids / Adults) and its price. */
export interface PaymentRequest { id: string; clientId: string; clientName: string; clientPhone: string | null; name: string; price: number; offerType: "plan_type" | "bundle_type"; createdAt: string; proofUrl: string | null }
export interface DropInOption {
  label: string;
  price: number;
}

export interface SeriesInput {
  title: string;
  description: string | null;
  weekdays: number[];
  startTime: string;
  durationMin: number;
  dropInPrice: number;
  monthlyPrice: number;
  imageUrl: string | null;
  locationId?: string | null;
}

export interface PlanTypeInput {
  kind: GroupPlanTypeKind;
  name: string;
  price: number;
  durationMonths: number;
  credits: number | null;
  invitationsAllowance: number;
  locationId?: string | null;
}

export interface NewClientFields {
  name: string;
  phone: string | null;
  email: string | null;
}

type Method = "GET" | "POST";

/** A failed call, carrying the server's machine-readable `code` (e.g.
 * "active_plan_confirm") and the full error body, so a screen can react to a
 * specific refusal — like asking "charge a drop-in anyway?" — instead of just
 * showing the message. */
export class ApiError extends Error {
  code: string | null;
  data: Record<string, unknown> | null;
  // HTTP status, or undefined when the request never got an answer (offline, dropped).
  status?: number;
  constructor(message: string, code: string | null, data: Record<string, unknown> | null, status?: number) {
    super(message);
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

// The solo owner's small helper function (drop-in price, InstaPay QR, member-less drop-in).
const SOLO_DESK = "solo-desk";
// The fast staff client list.
const CLIENTS_LIST = "clients-list";

async function callFn<T>(path: string, opts?: { method?: Method; body?: Record<string, unknown>; quiet?: boolean }, slug: string = FN_SLUG): Promise<T> {
  const method = opts?.method ?? "GET";
  const started = performance.now();
  const send = () => supabase.functions.invoke(`${slug}/${path}`, { method, body: opts?.body });
  let { data, error } = await send();
  // A read that never got an answer (phone switching networks, app just woken)
  // is safe to send once more; a POST isn't, it may have gone through.
  if (error && method === "GET" && !(error as { context?: { status?: number } }).context?.status) {
    await new Promise((r) => setTimeout(r, 800));
    ({ data, error } = await send());
  }
  const took = Math.round(performance.now() - started);
  if (error) {
    let message = error.message;
    let code: string | null = null;
    let body: Record<string, unknown> | null = null;
    const ctx = (error as { context?: { json?: () => Promise<Record<string, unknown>>; status?: number } }).context;
    if (ctx?.json) {
      try {
        body = await ctx.json();
        if (typeof body?.error === "string") message = body.error;
        if (typeof body?.code === "string") code = body.code;
      } catch {
        // fall back to the raw error message
      }
    }
    // Every refusal and failure, by endpoint and reason — the broken flows. Only the
    // path (ids stripped), the status and the machine code are sent, never the message.
    const status = (ctx as { status?: number } | undefined)?.status;
    track("api_error", { path: cleanPath(path), method, status, code, ms: took });
    // No answer while offline or in the background is the phone, not a fault of ours.
    const unreachable = status === undefined && (!navigator.onLine || document.visibilityState === "hidden");
    if ((status === undefined || status >= 500) && !unreachable) reportError(error, { path: cleanPath(path), method, status });
    throw new ApiError(message, code, body, status);
  }
  if (method === "POST") track("api_ok", { path: cleanPath(path), method, ms: took });
  else if (took > 3000) track("api_slow", { path: cleanPath(path), method, ms: took });
  // POSTs are the app's only mutations — bump so every mounted useAsync
  // screen revalidates, not just whichever one happened to trigger this.
  // A `quiet` POST (registering this device for notifications) changes nothing
  // a screen shows, so it must not make every open screen load again.
  if (method === "POST" && !opts?.quiet) bump();
  return data as T;
}

export const auth = {
  async signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  },
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },
  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error(error.message);
  },
  async updatePassword(password: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  },
};

export const api = {
  // Returns { profile } for an org staff signup, or { bizqwikTeam } for a
  // Bizqwik-team signup — decided by which invite the email matched.
  signup: (name: string, email: string, password: string) =>
    callFn<{ profile?: Profile; bizqwikTeam?: BizqwikTeam }>("signup", { method: "POST", body: { name, email, password } }),

  me: () => callFn<{ profile: Profile | null; orgMode?: "solo" | "team" | null; org?: { id: string; name: string; slug: string } | null; tier: Tier | null; bizqwikTeam: BizqwikTeam | null }>("me"),
  // With `locationId`, only that location's sales.
  paymentsSummary: async (months: number, locationId?: string | null): Promise<PaymentsSummary> => {
    const r = await callFn<Partial<PaymentsSummary>>(`payments/summary?months=${months}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}`);
    return { months: r.months ?? months, total: r.total ?? 0, byMethod: r.byMethod ?? [], transfers: r.transfers ?? [], byMonth: r.byMonth ?? [] };
  },
  updateMe: (name: string) => callFn<{ profile: Profile }>("me/update", { method: "POST", body: { name } }),
  updateAvatar: (avatarUrl: string | null) => callFn<{ profile: Profile }>("me/update", { method: "POST", body: { avatarUrl } }),

  tiers: () => callFn<{ tiers: Tier[] }>("tiers"),
  createTier: (name: string, rate: number, privateCutPct: number) =>
    callFn<{ tier: Tier }>("tiers", { method: "POST", body: { name, rate, privateCutPct } }),
  updateTier: (id: string, name: string, rate: number, privateCutPct: number) =>
    callFn<void>("tiers/update", { method: "POST", body: { id, name, rate, privateCutPct } }),
  deleteTier: (id: string) => callFn<void>("tiers/delete", { method: "POST", body: { id } }),

  bundleTypes: () => callFn<{ bundleTypes: BundleType[] }>("bundle-types"),
  createBundleType: (name: string, price: number, sessionsIncluded: number, expiryDays: number, locationId?: string | null) =>
    callFn<{ bundleType: BundleType }>("bundle-types", { method: "POST", body: { name, price, sessionsIncluded, expiryDays, locationId } }),
  updateBundleType: (id: string, name: string, price: number, sessionsIncluded: number, expiryDays: number, locationId?: string | null) =>
    callFn<void>("bundle-types/update", { method: "POST", body: { id, name, price, sessionsIncluded, expiryDays, locationId } }),

  // ===== Locations =====
  locations: () => callFn<{ locations: Location[] }>("locations"),
  createLocation: (name: string) => callFn<{ location: Location }>("locations", { method: "POST", body: { name } }),
  renameLocation: (id: string, name: string) => callFn<{ location: Location }>("locations/update", { method: "POST", body: { id, name } }),
  setClientLocation: (id: string, locationId: string | null) => callFn<{ ok: true }>("clients/location", { method: "POST", body: { id, locationId } }),
  deleteBundleType: (id: string) => callFn<void>("bundle-types/delete", { method: "POST", body: { id } }),

  // ===== Accounting: expenses, recurring expenses, profit & loss =====
  expenseCategories: () => callFn<{ categories: ExpenseCategory[] }>("accounting/categories"),
  createExpenseCategory: (name: string) => callFn<{ category: ExpenseCategory }>("accounting/categories", { method: "POST", body: { name } }),
  renameExpenseCategory: (id: string, name: string) => callFn<{ category: ExpenseCategory }>("accounting/categories/update", { method: "POST", body: { id, name } }),
  setExpenseCategoryArchived: (id: string, archived: boolean) => callFn<{ category: ExpenseCategory }>("accounting/categories/update", { method: "POST", body: { id, archived } }),

  expenses: (month: string) => callFn<{ expenses: Expense[] }>(`accounting/expenses?month=${month}`),
  addExpense: (categoryId: string, amount: number, date: string, note?: string, receipt?: string) =>
    callFn<{ expense: Expense }>("accounting/expenses", { method: "POST", body: { categoryId, amount, date, note, receipt } }),
  updateExpense: (id: string, patch: { categoryId?: string; amount?: number; date?: string; note?: string }) =>
    callFn<{ expense: Expense }>("accounting/expenses/update", { method: "POST", body: { id, ...patch } }),
  deleteExpense: (id: string) => callFn<{ ok: true }>("accounting/expenses/delete", { method: "POST", body: { id } }),

  recurringExpenses: () => callFn<{ recurring: RecurringExpense[] }>("accounting/recurring"),
  createRecurringExpense: (categoryId: string, amount: number, dayOfMonth: number, note?: string, endMonth?: string) =>
    callFn<{ recurring: RecurringExpense }>("accounting/recurring", { method: "POST", body: { categoryId, amount, dayOfMonth, note, endMonth } }),
  updateRecurringExpense: (id: string, patch: { active?: boolean; amount?: number; categoryId?: string; note?: string; dayOfMonth?: number; endMonth?: string | null }) =>
    callFn<{ recurring: RecurringExpense }>("accounting/recurring/update", { method: "POST", body: { id, ...patch } }),
  deleteRecurringExpense: (id: string) => callFn<{ ok: true }>("accounting/recurring/delete", { method: "POST", body: { id } }),

  pnl: (month: string) => callFn<PnlReport>(`accounting/pnl?month=${month}`),

  // The batched client list (one fixed set of queries however many clients);
  // if it's ever unavailable, the original endpoint answers instead.
  clients: async () => {
    try {
      return await callFn<{ clients: ClientWithPackage[] }>("clients", undefined, CLIENTS_LIST);
    } catch (err) {
      console.warn("clients-list unavailable, using the main endpoint", err);
      return callFn<{ clients: ClientWithPackage[] }>("clients");
    }
  },
  // Creation and coach assignment happen atomically, in one call — a client
  // never exists without an assigned coach (no orphaned/unassigned clients).
  createClient: (name: string, age: number | null, conditions: string | null, bundleTypeId: string, coachId: string) =>
    callFn<{ client: Client; package: PackageInstance }>("clients", { method: "POST", body: { name, age, conditions, bundleTypeId, coachId } }),
  updateClient: (id: string, name: string, age: number | null, conditions: string | null) =>
    callFn<{ client: Client }>("clients/update", { method: "POST", body: { id, name, age, conditions } }),
  deleteClient: (id: string) => callFn<void>("clients/delete", { method: "POST", body: { id } }),
  sellPackage: (clientId: string, bundleTypeId: string, coachId: string, payMethod?: PayMethod) =>
    callFn<{ package: PackageInstance }>("packages", { method: "POST", body: { clientId, bundleTypeId, coachId, payMethod } }),
  // PT sessions are deducted only by scanning the member's per-bundle code.
  deliverSession: (qrToken: string) =>
    callFn<{ package: PackageInstance; preview: PtScanPreview }>("packages/deliver", { method: "POST", body: { qrToken } }),
  // A solo owner is her own clients' trainer: she logs today's session from the app.
  logPtSession: (packageId: string) =>
    callFn<{ package: PackageInstance; preview: PtScanPreview }>("packages/deliver", { method: "POST", body: { packageId } }),
  // The FAB scanner: what did the coach just scan?
  scan: (token: string) => callFn<ScanResult>("scan", { method: "POST", body: { token } }),
  // Coach payout drill-down (accountant/dept_head/head_coach): every private
  // package a coach sold in a given month, with client/bundle names attached.
  packagesByCoach: (coachId: string, month: string) => callFn<{ packages: PackageWithNames[] }>(`packages/by-coach/${coachId}/${month}`),

  invites: () => callFn<{ invites: Invite[] }>("invites"),
  createInvite: (email: string, role: Role, tierId: string | null) =>
    callFn<void>("invites", { method: "POST", body: { email, role, tierId } }),
  deleteInvite: (email: string) => callFn<void>("invites/delete", { method: "POST", body: { email } }),

  profiles: () => callFn<{ profiles: Profile[] }>("profiles"),
  assignTier: (id: string, tierId: string | null) => callFn<void>("profiles/assign-tier", { method: "POST", body: { id, tierId } }),
  removeProfile: (id: string) => callFn<void>("profiles/remove", { method: "POST", body: { id } }),

  month: (month: string) => callFn<{ rows: Rollup[] }>(`month/${month}`),
  sessions: (coachId: string, month: string) => callFn<{ sessions: Session[] }>(`sessions/${coachId}/${month}`),
  addSession: (coachId: string, month: string, date: string, scanToken?: string) =>
    callFn<{ session: Session }>("sessions/add", { method: "POST", body: { coachId, month, date, scanToken } }),
  editSession: (id: string, coachId: string, month: string, date: string) =>
    callFn<{ session: Session }>("sessions/edit", { method: "POST", body: { id, coachId, month, date } }),
  removeSession: (id: string, coachId: string, month: string) =>
    callFn<void>("sessions/remove", { method: "POST", body: { id, coachId, month } }),

  settle: (coachId: string, month: string) => callFn<void>("settle", { method: "POST", body: { coachId, month } }),
  reopen: (coachId: string, month: string) => callFn<void>("reopen", { method: "POST", body: { coachId, month } }),
  pay: (coachId: string, month: string) => callFn<void>("pay", { method: "POST", body: { coachId, month } }),

  // Front desk. Coach names only — no payout data, unlike month().
  coaches: () => callFn<{ coaches: CoachOption[] }>("coaches"),
  createServiceClient: (fields: NewClientFields, bundleTypeId: string, coachId: string, payMethod?: PayMethod) =>
    callFn<{ client: Client; package: PackageInstance }>("clients", { method: "POST", body: { ...fields, bundleTypeId, coachId, payMethod } }),
  assignCoach: (id: string, coachId: string) => callFn<{ client: Client }>("clients/assign-coach", { method: "POST", body: { id, coachId } }),
  frontDeskSummary: () => callFn<FrontDeskSummary>("front-desk/summary"),
  // A class bundle loses one session on every check-in (a second scan within a minute is refused as accidental);
  // memberships, class monthlies and PT don't. `plan` is the plan afterwards.
  // `locationId` (where the check-in happens) turns away a plan sold for another location.
  checkIn: (clientId: string, source: "qr" | "manual", locationId?: string | null) =>
    callFn<{ deducted: boolean; plan: { name: string; kind: string; creditsRemaining: number | null; creditsTotal: number | null } | null }>("check-ins", { method: "POST", body: { clientId, source, locationId: locationId ?? undefined } }),
  // A walk-in is always recorded against a member: an existing client, or a
  // new one created with the sale (the backend also registers their app invite).
  orgSettings: async () => {
    const r = await callFn<{ dropInPrice?: number | null; dropInPrices?: Record<string, number | null>; dropInOptions?: Record<string, DropInOption[]>; instapayQr?: string | null; instapayAddress?: string | null }>("org-settings", undefined, SOLO_DESK);
    return { dropInPrice: r.dropInPrice ?? null, dropInPrices: r.dropInPrices ?? {}, dropInOptions: r.dropInOptions ?? {}, instapayQr: r.instapayQr ?? null, instapayAddress: r.instapayAddress ?? null };
  },
  // With `locationId`, sets that location's own drop-in price.
  saveOrgSettings: (patch: { dropInPrice?: number | null; instapayQr?: string | null; instapayAddress?: string | null; locationId?: string; dropInOptions?: DropInOption[] }) => callFn<{ ok: true }>("org-settings", { method: "POST", body: patch }, SOLO_DESK),
  // Members who paid by InstaPay and uploaded the receipt, waiting for her to approve.
  paymentRequests: () => callFn<{ requests: PaymentRequest[] }>("payment-requests"),
  approvePayment: (id: string) => callFn<{ ok: true }>(`payment-requests/${id}/approve`, { method: "POST" }),
  rejectPayment: (id: string, note?: string) => callFn<{ ok: true }>(`payment-requests/${id}/reject`, { method: "POST", body: { note } }),
  soloDropIn: (payMethod: "cash" | "instapay", locationId?: string | null, label?: string) => callFn<void>("drop-ins", { method: "POST", body: { payMethod, locationId: locationId ?? undefined, label } }, SOLO_DESK),
  dropIn: (member: { clientId: string } | { newClient: NewClientFields }, category: string, price: number, payMethod?: PayMethod, confirmActivePlan = false) =>
    callFn<void>("drop-ins", { method: "POST", body: { ...member, category, price, payMethod, confirmActivePlan } }),
  // A seat in one class session at its drop-in price; lands on the roster.
  classDropIn: (clientId: string, classId: string, payMethod: PayMethod, confirmActivePlan = false) =>
    callFn<void>("drop-ins", { method: "POST", body: { clientId, classId, payMethod, confirmActivePlan } }),
  invite: (clientId: string, inviteeName: string, inviteePhone: string, visitDate: string) =>
    callFn<{ invitationsRemaining: number }>("invitations", { method: "POST", body: { clientId, inviteeName, inviteePhone, visitDate } }),

  // ===== Services: recurring classes, group plan catalog, plan sales, revenue =====
  classSeries: () => callFn<{ series: ClassSeries[] }>("class-series"),
  createClassSeries: (s: SeriesInput) => callFn<{ series: ClassSeries }>("class-series", { method: "POST", body: { ...s } }),
  updateClassSeries: (id: string, s: SeriesInput) =>
    callFn<{ series: ClassSeries; keptBookedSessions: number }>("class-series/update", { method: "POST", body: { id, ...s } }),
  endClassSeries: (id: string) => callFn<{ ok: true; keptBookedSessions: number }>("class-series/end", { method: "POST", body: { id } }),

  planTypes: () => callFn<{ planTypes: GroupPlanType[] }>("plan-types"),
  createPlanType: (p: PlanTypeInput) => callFn<{ planType: GroupPlanType }>("plan-types", { method: "POST", body: { ...p } }),
  updatePlanType: (id: string, p: PlanTypeInput & { active?: boolean }) =>
    callFn<{ planType: GroupPlanType }>("plan-types/update", { method: "POST", body: { id, ...p } }),
  deletePlanType: (id: string) => callFn<{ ok: true }>("plan-types/delete", { method: "POST", body: { id } }),

  // Front desk: sell a group plan to an existing member or a brand-new one.
  // `offer` is a catalog plan or a class series (that class's monthly).
  sellGroupPlan: (target: { clientId: string } | NewClientFields, offer: { planTypeId: string } | { seriesId: string }, payMethod: PayMethod) =>
    callFn<{ client: ClientWithPackage; plan: GroupPlan }>("group-plans/sell", { method: "POST", body: { ...target, ...offer, payMethod } }),
  clientPlans: (clientId: string) => callFn<{ activePlan: GroupPlan | null; plans: GroupPlan[] }>(`group-plans/client/${clientId}`),

  // `history` also returns the month-by-month series for that many months in the same call.
  revenue: (months = 6, history?: number) => callFn<RevenueReport>(`revenue?months=${months}${history ? `&history=${history}` : ""}`),

  // ===== Classes (staff read; dept_head writes) =====
  classes: (since?: string) => callFn<{ classes: GymClass[] }>(since ? `classes?since=${encodeURIComponent(since)}` : "classes"),
  // `imageUrl` is the session's own photo; a series session sends null and
  // shows its series' photo.
  createClass: (title: string, description: string | null, startsAt: string, price: number, imageUrl: string | null = null, locationId?: string | null) =>
    callFn<{ class: GymClass }>("classes", { method: "POST", body: { title, description, startsAt, price, imageUrl, locationId } }),
  updateClass: (id: string, title: string, description: string | null, startsAt: string, price: number, imageUrl: string | null = null, locationId?: string | null) =>
    callFn<{ class: GymClass }>("classes/update", { method: "POST", body: { id, title, description, startsAt, price, imageUrl, locationId } }),
  cancelClass: (id: string) => callFn<{ ok: true }>("classes/cancel", { method: "POST", body: { id } }),

  // ===== Class roster / attendance / at-desk collection (dept_head + front_desk) =====
  classBookings: (classId: string) => callFn<{ bookings: ClassBooking[] }>(`classes/${classId}/bookings`),
  markAttendance: (bookingId: string, attendance: "arrived" | "no_show" | "booked") =>
    callFn<{ ok: true }>("bookings/attendance", { method: "POST", body: { bookingId, attendance } }),
  collectBooking: (bookingId: string, payMethod: PayMethod) =>
    callFn<{ ok: true }>("bookings/collect", { method: "POST", body: { bookingId, payMethod } }),

  // ===== Staff activity feed / logs (dept_head + front_desk) =====
  activity: (limit = 100) => callFn<{ activity: ActivityEntry[] }>(`activity?limit=${limit}`),

  // Invite an existing client to the branded member app (front_desk / dept_head).
  inviteClient: (clientId: string, email: string) =>
    callFn<{ ok: true }>("client-invites", { method: "POST", body: { clientId, email } }),

  // Money flow (front_desk + dept_head). Refund to wallet (store credit) or "desk"
  // (external money, recorded only); compensation is a dept_head goodwill credit.
  refundClient: (clientId: string, amount: number, destination: "wallet" | "desk", note?: string) =>
    callFn<{ ok: true; walletBalance?: number }>("clients/refund", { method: "POST", body: { clientId, amount, destination, note: note ?? null } }),
  refundable: (clientId: string) => callFn<{ paid: number; refunded: number; refundable: number }>(`clients/refundable/${clientId}`),
  compensateClient: (clientId: string, amount: number, note?: string) =>
    callFn<{ ok: true; walletBalance?: number }>("clients/compensate", { method: "POST", body: { clientId, amount, note: note ?? null } }),

  pushVapidPublicKey: () => callFn<{ publicKey: string }>("push/vapid-public-key"),
  pushSubscribe: (sub: PushSubscriptionJSON, deviceId: string) =>
    callFn<void>("push/subscribe", { method: "POST", body: { ...sub, deviceId } as Record<string, unknown>, quiet: true }),
  pushUnsubscribe: (endpoint: string, deviceId: string) => callFn<void>("push/unsubscribe", { method: "POST", body: { endpoint, deviceId }, quiet: true }),

  // ===== Bizqwik ops dashboard (bizqwik_team only) =====
  ops: {
    summary: () => callFn<OpsSummary>("ops/summary"),
    orgs: () => callFn<{ orgs: OrgSummary[] }>("ops/orgs"),
    createOrg: (name: string, slug: string, deptHeadName: string, deptHeadEmail: string, planId: string | null) =>
      callFn<{ org: OrgSummary; deptHeadEmail: string; domain?: { name: string; connected: boolean; reason: string | null } }>("ops/orgs", {
        method: "POST",
        body: { name, slug, deptHeadName, deptHeadEmail, planId },
      }),
    org: (id: string) => callFn<OrgDetail>(`ops/orgs/${id}`),
    setOrgStatus: (id: string, status: OrgStatus) =>
      callFn<{ ok: true; status: OrgStatus }>(`ops/orgs/${id}/status`, { method: "POST", body: { status } }),
    setOrgMode: (id: string, mode: "solo" | "team") =>
      callFn<{ ok: true; mode: "solo" | "team" }>(`ops/orgs/${id}/mode`, { method: "POST", body: { mode } }),
    setOrgPlan: (id: string, planId: string | null) =>
      callFn<{ ok: true; planId: string | null }>(`ops/orgs/${id}/plan`, { method: "POST", body: { planId } }),
    // Permanent: removes the org and everything under it. `confirmSlug` must match.
    deleteOrg: (id: string, confirmSlug: string) =>
      callFn<{ ok: true; name: string; loginsRemoved: number }>(`ops/orgs/${id}/delete`, { method: "POST", body: { confirmSlug } }),
    orgConfig: (id: string) => callFn<OrgConfig>(`ops/orgs/${id}/config`),
    setOrgBranding: (id: string, b: OrgBrandingConfig) =>
      callFn<{ ok: true }>(`ops/orgs/${id}/branding`, { method: "POST", body: { ...b } }),
    setOrgSettings: (id: string, settings: OrgPointsSettings) =>
      callFn<{ ok: true }>(`ops/orgs/${id}/settings`, { method: "POST", body: { ...settings } }),

    team: () => callFn<{ members: BizqwikTeam[]; invites: BizqwikTeamInvite[] }>("ops/team"),
    inviteTeam: (name: string, email: string, role: BizqwikRole) =>
      callFn<{ ok: true }>("ops/team/invite", { method: "POST", body: { name, email, role } }),
    cancelTeamInvite: (email: string) => callFn<{ ok: true }>("ops/team/cancel-invite", { method: "POST", body: { email } }),

    plans: () => callFn<{ plans: PlanType[] }>("ops/plans"),
    createPlan: (name: string, price: number, teamSizeLimit: number | null, clientSizeLimit: number | null) =>
      callFn<{ plan: PlanType }>("ops/plans", { method: "POST", body: { name, price, teamSizeLimit, clientSizeLimit } }),
    updatePlan: (id: string, name: string, price: number, teamSizeLimit: number | null, clientSizeLimit: number | null) =>
      callFn<{ plan: PlanType }>("ops/plans/update", { method: "POST", body: { id, name, price, teamSizeLimit, clientSizeLimit } }),
    deletePlan: (id: string) => callFn<{ ok: true }>("ops/plans/delete", { method: "POST", body: { id } }),
  },
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const now = new Date();
const CURRENT_MONTH = monthKey(now);
// current month + the two before it, for the month switcher/segmented control
const MONTHS = [2, 1, 0].map((offset) => monthKey(new Date(now.getFullYear(), now.getMonth() - offset, 1)));

export const MOCK = { CURRENT_MONTH, MONTHS };

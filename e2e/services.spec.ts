import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// Services model: dept_head as SME founder (money overview, catalog, Create
// FAB, read-only clients, activity under History) and the front desk selling
// group plans + class drop-ins with the "plan still running" check.

const inDays = (d: number, hour = 19) => {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};

const REVENUE = {
  months: [
    { month: "2026-07", revenue: 12000, payouts: 5000, profit: 7000 },
    { month: "2026-08", revenue: 15500, payouts: 6000, profit: 9500 },
    { month: "2026-09", revenue: 18250, payouts: 7250, profit: 11000 },
  ],
  totals: { revenue: 45750, payouts: 18250, profit: 27500 },
  byService: [
    { key: "group", label: "Group training", amount: 30750 },
    { key: "private_training", label: "Private training", amount: 15000 },
  ],
  byType: [
    { key: "membership", label: "Memberships", amount: 18000 },
    { key: "pt_bundle", label: "PT bundles", amount: 15000 },
    { key: "class_drop_in", label: "Class drop-ins", amount: 12750 },
  ],
  byCoach: [{ coachId: "c1", name: "Coach Nour", revenue: 15000, payouts: 9000 }],
  activeSubscribers: { total: 42, groupPlans: 30, ptPackages: 15, byPlanKind: { membership: 20, class_monthly: 6, bundle: 4 } },
  walletLiability: 3400,
};

const SERIES = [{ id: "s1", title: "Sunrise HIIT", description: null, weekdays: [6, 1, 3], startTime: "07:00", durationMin: 60, dropInPrice: 200, monthlyPrice: 1500, status: "active", activeMonthlySubscribers: 6 }];
const PLAN_TYPES = [
  { id: "p1", kind: "membership", name: "All-Access · 3 Months", price: 9000, durationMonths: 3, credits: null, invitationsAllowance: 2, active: true },
  { id: "p2", kind: "bundle", name: "10-Class Pack", price: 1800, durationMonths: 2, credits: 10, invitationsAllowance: 0, active: true },
];

test("dept_head: overview shows the money view; nav has Catalog", async ({ page }) => {
  await mockBackend(page, "dept_head", { revenue: REVENUE });
  await page.goto("/oversight");
  await expect(page.getByText("REVENUE · THIS MONTH · EGP")).toBeVisible();
  await expect(page.getByText("18,250").first()).toBeVisible();
  await expect(page.getByText("REVENUE VS COACH PAYOUTS")).toBeVisible();
  await expect(page.getByText("Group training")).toBeVisible();
  await expect(page.getByText("Coach Nour")).toBeVisible();
  await expect(page.getByText("WALLET CREDIT OUT")).toBeVisible();
  // The Activity tile no longer lives on the home screen.
  await expect(page.getByText("Member feed and the full transaction log")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Catalog/ }).or(page.getByText("Catalog", { exact: true })).first()).toBeVisible();
});

test("dept_head: Create FAB → new group class with weekday picker posts a series", async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await mockBackend(page, "dept_head", {
    revenue: REVENUE,
    "class-series": (body) => {
      if (body) posted = body;
      return { body: body ? { series: { ...SERIES[0], ...body, id: "s2" } } : { series: SERIES } };
    },
  });
  await page.setViewportSize({ width: 390, height: 844 }); // the FAB is the phone layout's
  await page.goto("/oversight");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByText("What are you adding?")).toBeVisible();
  for (const t of ["Group class", "Class bundle", "Membership", "PT bundle"]) await expect(page.getByText(t, { exact: true })).toBeVisible();

  await page.getByText("Group class", { exact: true }).click();
  await expect(page.getByText("NEW GROUP CLASS")).toBeVisible();
  await page.getByPlaceholder("e.g. Sunrise HIIT").fill("Evening Yoga");
  await page.getByRole("button", { name: "Mon", exact: true }).click();
  await page.getByRole("button", { name: "Wed", exact: true }).click();
  await page.getByPlaceholder("Per class").fill("180");
  await page.getByPlaceholder("1 month").fill("1400");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByText("Class created")).toBeVisible();
  expect(posted).toMatchObject({ title: "Evening Yoga", weekdays: [1, 3], startTime: "18:00", durationMin: 60, dropInPrice: 180, monthlyPrice: 1400 });
});

test("dept_head: catalog lists classes and plans", async ({ page }) => {
  await mockBackend(page, "dept_head", { "class-series": { series: SERIES }, "plan-types": { planTypes: PLAN_TYPES } });
  await page.goto("/catalog");
  await expect(page.getByText("Sunrise HIIT")).toBeVisible();
  await expect(page.getByText("Sat · Mon · Wed · 7:00 AM · 60 min")).toBeVisible();
  await expect(page.getByText(/Drop-in 200 EGP · Monthly 1,500 EGP · 6 monthly/)).toBeVisible();
  await page.getByRole("button", { name: "PLANS" }).click();
  await expect(page.getByText("All-Access · 3 Months")).toBeVisible();
  await expect(page.getByText("10-Class Pack")).toBeVisible();
  await expect(page.getByText(/1,800 EGP · 10 classes · 2 months/)).toBeVisible();
});

test("dept_head: clients are read-only and History holds Activity", async ({ page }) => {
  await mockBackend(page, "dept_head", {
    clients: {
      clients: [
        {
          id: "cl1", name: "Mona Ali", age: 29, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null,
          groupPlan: { id: "g1", clientId: "cl1", kind: "bundle", planTypeId: "p2", seriesId: null, name: "10-Class Pack", priceAtSale: 1800, payMethod: "cash", creditsTotal: 10, creditsRemaining: 7, invitationsRemaining: 0, startsAt: inDays(-5), expiresAt: inDays(50), status: "active" },
        },
      ],
    },
    activity: { activity: [{ id: "a1", type: "sale_plan", amount: 1800, clientName: "Mona Ali", meta: { name: "10-Class Pack" }, at: new Date().toISOString() }] },
  });
  await page.goto("/clients");
  await expect(page.getByText("Mona Ali")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ New client" })).toHaveCount(0);
  await expect(page.getByText("ON A GROUP PLAN")).toBeVisible();

  await page.goto("/history");
  await page.getByRole("button", { name: "ACTIVITY" }).click();
  await expect(page.getByText("Mona Ali bought 10-Class Pack")).toBeVisible();
});

test("front desk: class drop-in asks before charging a member whose plan is running", async ({ page }) => {
  const calls: Record<string, unknown>[] = [];
  await mockBackend(page, "front_desk", {
    classes: { classes: [{ id: "k1", seriesId: "s1", title: "Sunrise HIIT", description: null, startsAt: inDays(1, 7), price: 200, status: "active" }] },
    "drop-ins": (body) => {
      calls.push(body ?? {});
      if (!body?.confirmActivePlan) {
        return { status: 409, body: { error: "Mona Ali still has 10-Class Pack (7 of 10 classes left, until 2026-11-20). Charge a drop-in anyway?", code: "active_plan_confirm" } };
      }
      return { body: { dropIn: { id: "d1" } } };
    },
  });
  await page.goto("/drop-in?client=cl1&name=Mona%20Ali");
  await expect(page.getByText("Drop into a class")).toBeVisible();
  await page.getByText("Choose a session (next 7 days)").click();
  await page.getByText(/Sunrise HIIT · .* · 200 EGP/).click();
  await page.getByRole("button", { name: "Confirm drop-in" }).click();

  await expect(page.getByText("Charge a drop-in anyway?").first()).toBeVisible();
  await expect(page.getByText(/still has 10-Class Pack/)).toBeVisible();
  await page.getByRole("button", { name: "Yes, charge the drop-in" }).click();
  await expect(page.getByText(/Drop-in recorded — Mona Ali · Sunrise HIIT · 200 EGP/)).toBeVisible();

  expect(calls).toHaveLength(2);
  expect(calls[0]).toMatchObject({ clientId: "cl1", classId: "k1", payMethod: "cash", confirmActivePlan: false });
  expect(calls[1]).toMatchObject({ clientId: "cl1", classId: "k1", confirmActivePlan: true });
});

test("front desk: sell a class monthly to a member with no plan", async ({ page }) => {
  let sold: Record<string, unknown> | null = null;
  await mockBackend(page, "front_desk", {
    clients: { clients: [{ id: "cl2", name: "Omar Z", age: null, phone: "0111", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan: null }] },
    "plan-types": { planTypes: PLAN_TYPES },
    "class-series": { series: SERIES },
    coaches: { coaches: [] },
    "group-plans/sell": (body) => {
      sold = body;
      return { body: { client: {}, plan: {} } };
    },
  });
  await page.goto("/members");
  await page.getByText("Omar Z").click();
  await expect(page.getByText("GROUP PLAN", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sell a group plan" }).click();
  await page.getByText("Membership, class monthly or bundle").click();
  for (const t of [/All-Access · 3 Months · 9,000 EGP · all classes · 3 months/, /10-Class Pack · 1,800 EGP · 10 classes · 2 months/, /Sunrise HIIT monthly · 1,500 EGP · 1 month/]) {
    await expect(page.getByText(t)).toBeVisible();
  }
  await page.getByText(/Sunrise HIIT monthly/).click();
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect(page.getByText("Plan started")).toBeVisible();
  expect(sold).toMatchObject({ clientId: "cl2", seriesId: "s1", payMethod: "cash" });
});

test("dept_head: class start time is picked on hour/minute/AM-PM wheels", async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await mockBackend(page, "dept_head", {
    "class-series": (body) => {
      if (body) posted = body;
      return { body: body ? { series: { ...SERIES[0], ...body, id: "s3" } } : { series: [] } };
    },
  });
  await page.goto("/catalog");
  await page.getByRole("button", { name: "+ New class" }).click();
  await page.getByPlaceholder("e.g. Sunrise HIIT").fill("Early Bird");
  await page.getByRole("button", { name: "Sat", exact: true }).click();
  await page.getByPlaceholder("Per class").fill("150");
  await page.getByPlaceholder("1 month").fill("1000");

  await page.getByRole("button", { name: /STARTS AT: 6:00 PM/ }).click();
  await page.getByRole("listbox", { name: "Hour" }).getByRole("option", { name: "7", exact: true }).click();
  await page.getByRole("listbox", { name: "Minute" }).getByRole("option", { name: "30", exact: true }).click();
  await page.getByRole("listbox", { name: "AM/PM" }).getByRole("option", { name: "AM", exact: true }).click();
  await expect(page.getByText("7:30 AM").first()).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: /STARTS AT: 7:30 AM/ })).toBeVisible();

  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByText("Class created")).toBeVisible();
  expect(posted).toMatchObject({ title: "Early Bird", weekdays: [6], startTime: "07:30" });
});

test("front desk: new client needs an email and gets an app invite", async ({ page }) => {
  let sold: Record<string, unknown> | null = null;
  let invited: Record<string, unknown> | null = null;
  await mockBackend(page, "front_desk", {
    clients: { clients: [{ id: "cl2", name: "Omar Z", age: null, phone: "0111", email: "omar@x.com", conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan: null }] },
    "plan-types": { planTypes: PLAN_TYPES },
    "class-series": { series: SERIES },
    coaches: { coaches: [] },
    "group-plans/sell": (body) => {
      sold = body;
      return { body: { client: { id: "cl9" }, plan: {} } };
    },
    "client-invites": (body) => {
      invited = body;
      return { body: { ok: true } };
    },
  });
  await page.goto("/members");
  await page.getByRole("button", { name: "+ New client" }).click();
  await page.getByLabel("FULL NAME", { exact: true }).fill("Mona K");
  await page.getByLabel("PHONE", { exact: true }).fill("0122");
  await page.getByText("Membership, class monthly or bundle").click();
  await page.getByText(/Sunrise HIIT monthly/).click();
  await page.getByRole("button", { name: "Create & start plan" }).click();
  await expect(page.getByText("Enter the client's email — they sign in to the app with it.")).toBeVisible();
  await page.getByLabel("EMAIL", { exact: true }).fill("omar@x.com");
  await page.getByRole("button", { name: "Create & start plan" }).click();
  await expect(page.getByText("Another client already uses this email.")).toBeVisible();
  expect(sold).toBeNull();
  await page.getByLabel("EMAIL", { exact: true }).fill(" Mona@X.com ");
  await page.getByRole("button", { name: "Create & start plan" }).click();
  await expect(page.getByText("Client created · app invite ready")).toBeVisible();
  expect(sold).toMatchObject({ name: "Mona K", phone: "0122", email: "mona@x.com", seriesId: "s1" });
  expect(invited).toEqual({ clientId: "cl9", email: "mona@x.com" });
});

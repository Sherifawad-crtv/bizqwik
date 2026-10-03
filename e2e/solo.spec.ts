import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

const REVENUE = {
  months: [{ month: "2026-10", revenue: 3500, payouts: 0, profit: 3500 }],
  totals: { revenue: 3500, payouts: 0, profit: 3500 },
  byService: [], byType: [], byCoach: [],
  activeSubscribers: { total: 7, groupPlans: 7, ptPackages: 0, byPlanKind: {} }, walletLiability: 0,
};
const PAYMENTS = {
  months: 1, total: 3500,
  byMethod: [
    { method: "instapay", label: "InstaPay", amount: 2500, count: 5 },
    { method: "cash", label: "Cash", amount: 1000, count: 2 },
  ],
  transfers: [{ id: "t1", at: new Date().toISOString(), clientName: "Mona Ali", amount: 500, what: "Monthly" }],
};

async function boot(page: import("@playwright/test").Page, mode: "solo" | "team") {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", {
    __orgMode: mode,
    "front-desk/summary": { todayCheckIns: 2, todayDropIns: 0, activeNow: 1, recent: [] },
    clients: { clients: [] },
    classes: { classes: [] },
    revenue: REVENUE,
    "payments/summary": PAYMENTS,
    activity: { activity: [
      { id: "a1", type: "sale_plan", amount: 500, clientName: "Mona Ali", meta: { payMethod: "instapay", name: "1 Month" }, at: new Date().toISOString() },
      { id: "a2", type: "sale_plan", amount: 1000, clientName: "Omar Z", meta: { payMethod: "cash", name: "3 Months" }, at: new Date().toISOString() },
      { id: "a3", type: "refund_desk", amount: 150, clientName: "Mona Ali", meta: { note: "InstaPay · left town" }, at: new Date().toISOString() },
    ] },
  });
}

test("solo owner: five tabs, the desk as home, and no team tools", async ({ page }) => {
  await boot(page, "solo");
  await page.goto("/");
  await expect(page.getByText("REVENUE", { exact: true }).first()).toBeVisible();
  for (const l of ["Today", "Clients", "Plans", "Schedule", "Money"]) await expect(page.getByRole("link", { name: l, exact: true })).toBeVisible();
  for (const l of ["Team", "Catalog", "History", "Overview", "Members"]) await expect(page.getByRole("link", { name: l, exact: true })).toHaveCount(0);
});

test("solo owner: Money shows revenue, how it was paid, and one transactions list with a method label", async ({ page }) => {
  await boot(page, "solo");
  await page.goto("/");
  await page.getByRole("link", { name: "Money", exact: true }).click();
  await expect(page).toHaveURL(/\/money$/);
  await expect(page.getByText("3,500").first()).toBeVisible();
  await expect(page.getByText("InstaPay · 2,500")).toBeVisible();
  await expect(page.getByText("InstaPay transfers")).toHaveCount(0);
  await expect(page.getByText("Transactions", { exact: true })).toBeVisible();
  await expect(page.getByText("Mona Ali").first()).toBeVisible();
  await expect(page.getByText("CASH", { exact: true })).toBeVisible();
  await expect(page.getByText("INSTAPAY", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("−150")).toBeVisible();
  await expect(page.getByText("How you were paid")).toHaveCount(0);
  // A row opens the full details of that transaction.
  await page.getByRole("button", { name: /Omar Z/ }).click();
  await expect(page.getByText("TRANSACTION", { exact: true })).toBeVisible();
  await expect(page.getByText("PAID VIA", { exact: true })).toBeVisible();
  await expect(page.getByText("CLIENT", { exact: true })).toBeVisible();
  await expect(page.getByText("3 Months").last()).toBeVisible();
});

test("team owner is unchanged: Overview home with the full roster of tabs", async ({ page }) => {
  await boot(page, "team");
  await page.goto("/");
  await expect(page).toHaveURL(/\/oversight$/);
  await expect(page.getByRole("link", { name: "Team", exact: true })).toBeVisible();
});

test("solo home: four insight cards, a revenue chart, two quick actions, links opposite their titles", async ({ page }) => {
  await boot(page, "solo");
  const ends = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
  const gp = (name: string, d: number) => ({ id: "p", clientId: "x", kind: "membership", planTypeId: null, seriesId: null, name, priceAtSale: 500, payMethod: "instapay", creditsTotal: null, creditsRemaining: null, invitationsRemaining: 0, startsAt: ends(-20), expiresAt: ends(d), status: "active" });
  const c = (id: string, name: string, groupPlan: unknown) => ({ id, name, age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan });
  await page.route(/clients$/, (r) => r.fallback());
  await mockBackend(page, "dept_head", {
    __orgMode: "solo",
    "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [{ id: "r1", kind: "check_in", name: "Mona Ali", detail: "Checked in", at: new Date().toISOString() }] },
    clients: { clients: [c("1", "Mona Ali", gp("1 Month", 3)), c("2", "Omar Said", gp("3 Months", 60)), c("3", "Lina", null)] },
    classes: { classes: [] },
    revenue: { ...REVENUE, months: [{ month: "2026-09", revenue: 2000, payouts: 0, profit: 2000 }, { month: "2026-10", revenue: 3500, payouts: 0, profit: 3500 }] },
    "payments/summary": PAYMENTS,
  });
  await page.goto("/");
  await expect(page.getByText("MEMBERS", { exact: true })).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible(); // members total
  await expect(page.getByText("ACTIVE", { exact: true })).toBeVisible();
  await expect(page.getByText("ENDING SOON", { exact: true })).toBeVisible();
  await expect(page.getByText("REVENUE BY MONTH · EGP")).toBeVisible();
  const qa = page.getByRole("group", { name: "Quick actions" });
  await expect(qa.getByRole("button")).toHaveCount(3);
  await expect(qa.getByRole("button", { name: "Check in" })).toBeVisible();
  await expect(qa.getByRole("button", { name: "New client" })).toBeVisible();
  await expect(qa.getByRole("button", { name: "Drop-in" })).toBeVisible();
  // The link sits on the title's row, not under the list; plans and activity are not on Today.
  const titleY = (await page.getByText("Coming up", { exact: true }).boundingBox())!.y;
  const linkY = (await page.getByRole("button", { name: "Schedule", exact: true }).first().boundingBox())!.y;
  await expect(page.getByText("Your plans")).toHaveCount(0);
  await expect(page.getByText("Recent activity")).toHaveCount(0);
  expect(Math.abs(titleY - linkY)).toBeLessThan(14);
  // Tapping a card lands on Members already filtered.
  await page.getByText("ENDING SOON", { exact: true }).click();
  await expect(page).toHaveURL(/\/members$/);
  await expect(page.getByRole("button", { name: /Ending soon · 1/ })).toBeVisible();
});

test("solo: a new client picks between two plans as cards", async ({ page }) => {
  await boot(page, "solo");
  await page.goto("/");
  await mockBackend(page, "dept_head", {
    __orgMode: "solo",
    "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] },
    clients: { clients: [] },
    classes: { classes: [] },
    revenue: REVENUE,
    "plan-types": { planTypes: [
      { id: "m1", kind: "membership", name: "1 Month", price: 1200, durationMonths: 1, credits: null, invitationsAllowance: 0, active: true },
      { id: "m3", kind: "membership", name: "3 Months", price: 3000, durationMonths: 3, credits: null, invitationsAllowance: 0, active: true },
    ] },
    "class-series": { series: [] },
    "bundle-types": { bundleTypes: [] },
    coaches: { coaches: [] },
  });
  await page.goto("/");
  await page.getByRole("group", { name: "Quick actions" }).getByRole("button", { name: "New client" }).click();
  await page.getByLabel("FULL NAME").fill("Mona K");
  await page.getByLabel("PHONE").fill("0122");
  await page.getByLabel("EMAIL").fill("mona@x.com");
  await page.getByRole("button", { name: "Next", exact: true }).last().click();
  await expect(page.getByRole("radio", { name: /1 Month/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /3 Months/ })).toBeVisible();
  await expect(page.getByText("PT PACKAGE")).toHaveCount(0);
});

test("solo owner never lands on team screens: Activity goes back home, and team URLs bounce to Today", async ({ page }) => {
  await boot(page, "solo");
  await mockBackend(page, "dept_head", {
    __orgMode: "solo",
    "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] },
    clients: { clients: [] }, classes: { classes: [] }, revenue: REVENUE, activity: { activity: [] },
  });
  await page.goto("/");
  await page.goto("/activity");
  await page.getByRole("button", { name: "Today" }).first().click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  for (const path of ["/history", "/coaches", "/oversight", "/manage", "/clients"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  }
});

test("solo: Check in lists everyone with a button each, searchable, and each answers for itself", async ({ page }) => {
  const sent: string[] = [];
  const ends = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
  const gp = (name: string) => ({ id: "p", clientId: "x", kind: "membership", planTypeId: null, seriesId: null, name, priceAtSale: 500, payMethod: "instapay", creditsTotal: null, creditsRemaining: null, invitationsRemaining: 0, startsAt: ends(-20), expiresAt: ends(20), status: "active" });
  const c = (id: string, name: string, groupPlan: unknown) => ({ id, name, age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan });
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", {
    __orgMode: "solo",
    "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] },
    clients: { clients: [c("c1", "Mona Ali", gp("1 Month")), c("c2", "Omar Said", gp("1 Month")), c("c3", "Lina Hassan", null)] },
    classes: { classes: [] }, revenue: REVENUE,
    "check-ins": (body: any) => {
      sent.push(body.clientId);
      if (body.clientId === "c3") return { status: 400, body: { error: "Lina Hassan has no active plan or package." } };
      return { body: { checkIn: { id: "ci" }, deducted: false, plan: null } };
    },
  });
  await page.goto("/");
  await page.getByRole("group", { name: "Quick actions" }).getByRole("button", { name: "Check in" }).click();
  await expect(page.getByRole("button", { name: "Check in", exact: true })).toHaveCount(3 + 1); // one per client + the quick action behind the sheet
  await page.getByLabel("Search name or phone").fill("omar");
  await expect(page.getByText("Mona Ali")).toHaveCount(0);
  await page.getByLabel("Search name or phone").fill("");
  await page.getByTestId("checkin-row").filter({ hasText: "Mona Ali" }).getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Done").first()).toBeVisible();
  await page.getByTestId("checkin-row").filter({ hasText: "Lina Hassan" }).getByRole("button", { name: "Check in" }).click();
  await expect(page.getByRole("alert")).toContainText("no active plan");
  expect(sent).toEqual(["c1", "c3"]);
});

test("solo: Plans is a tab with add/edit/delete, plans only", async ({ page }) => {
  await boot(page, "solo");
  await page.goto("/");
  await page.getByRole("link", { name: "Plans", exact: true }).click();
  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByText("My plans")).toBeVisible();
  await expect(page.getByRole("button", { name: "CLASSES" })).toHaveCount(0);
  await expect(page.getByText("Class bundles")).toHaveCount(0);
  await page.getByRole("button", { name: "+ Plan" }).click();
  await expect(page.getByText("NEW MEMBERSHIP", { exact: true }).first()).toBeVisible();
});

test("solo: Schedule adds a new session and shows who's coming; Account has no import", async ({ page }) => {
  await boot(page, "solo");
  const created: unknown[] = [];
  await page.route("**/classes", async (route) => {
    if (route.request().method() === "POST") {
      created.push(route.request().postDataJSON());
      return route.fulfill({ json: { class: { id: "n1", title: "Morning", description: null, startsAt: new Date().toISOString(), price: 0, status: "active" } } });
    }
    return route.fallback();
  });
  await page.goto("/");
  await page.getByRole("link", { name: "Schedule", exact: true }).click();
  await page.getByRole("button", { name: "New session" }).click();
  await page.getByPlaceholder("e.g. Sunrise HIIT").fill("Morning");
  await expect(page.getByText("DROP-IN PRICE")).toHaveCount(0);
  await page.getByRole("button", { name: "Create session" }).click();
  await expect.poll(() => created.length).toBe(1);
  await page.goto("/account");
  await expect(page.getByText("Import members")).toHaveCount(0);
});

const QR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function dropInBoot(page: import("@playwright/test").Page, settings: unknown, sent: unknown[]) {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", {
    __orgMode: "solo",
    clients: { clients: [] }, classes: { classes: [] }, revenue: REVENUE,
    "org-settings": settings,
    "drop-ins": (b: Record<string, unknown> | null) => { sent.push(b); return { body: {} }; },
  });
  await page.goto("/");
  await page.getByRole("group", { name: "Quick actions" }).getByRole("button", { name: "Drop-in" }).click();
}

test("solo drop-in: the set price, cash received, nothing else asked", async ({ page }) => {
  const sent: unknown[] = [];
  await dropInBoot(page, { dropInPrice: 150, instapayQr: QR }, sent);
  await expect(page.getByText("150", { exact: true })).toBeVisible();
  await expect(page.getByText("Link member")).toHaveCount(0);
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await page.getByRole("button", { name: "Cash received" }).click();
  await expect(page.getByText("Drop-in recorded")).toBeVisible();
  expect(sent).toEqual([{ anonymous: true, payMethod: "cash" }]);
});

test("solo drop-in: InstaPay shows her QR before payment is confirmed", async ({ page }) => {
  const sent: unknown[] = [];
  await dropInBoot(page, { dropInPrice: 150, instapayQr: QR }, sent);
  await page.getByRole("button", { name: "InstaPay", exact: true }).click();
  await expect(page.getByAltText("InstaPay QR code")).toBeVisible();
  expect(sent).toEqual([]);
  await page.getByRole("button", { name: "Payment received" }).click();
  await expect(page.getByText("Drop-in recorded")).toBeVisible();
  expect(sent).toEqual([{ anonymous: true, payMethod: "instapay" }]);
});

test("solo drop-in: without a price it sends her to Plans to set one", async ({ page }) => {
  await dropInBoot(page, { dropInPrice: null, instapayQr: null }, []);
  await expect(page.getByText("Set your drop-in price first")).toBeVisible();
  await page.getByRole("button", { name: "Go to Plans" }).click();
  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByRole("button", { name: "Set price" })).toBeVisible();
});

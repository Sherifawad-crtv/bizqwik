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
  // The quick actions live in the FAB now, not on the page.
  await expect(page.getByRole("group", { name: "Quick actions" })).toHaveCount(0);
  await page.getByRole("button", { name: "Quick actions" }).click();
  const qa = page.getByRole("group", { name: "Quick actions" });
  await expect(qa.getByRole("button")).toHaveCount(4);
  await expect(qa.getByRole("button", { name: "Scan PT code" })).toBeVisible();
  await expect(qa.getByRole("button", { name: "Check in" })).toBeVisible();
  await expect(qa.getByRole("button", { name: "New client" })).toBeVisible();
  await expect(qa.getByRole("button", { name: "Drop-in" })).toBeVisible();
  // The link sits on the title's row, not under the list; plans and activity are not on Today.
  const titleY = (await page.getByText("Coming up", { exact: true }).boundingBox())!.y;
  const linkY = (await page.getByRole("button", { name: "Schedule", exact: true }).first().boundingBox())!.y;
  await expect(page.getByText("Your plans")).toHaveCount(0);
  await expect(page.getByText("Recent activity")).toHaveCount(0);
  expect(Math.abs(titleY - linkY)).toBeLessThan(14);
  await page.getByRole("button", { name: "Cancel" }).click();
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
  await page.getByRole("button", { name: "Quick actions" }).click();
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
  await page.getByRole("button", { name: "Quick actions" }).click();
  await page.getByRole("group", { name: "Quick actions" }).getByRole("button", { name: "Check in" }).click();
  await expect(page.getByRole("button", { name: "Check in", exact: true })).toHaveCount(3); // one per client
  await page.getByLabel("Search name or phone").fill("omar");
  await expect(page.getByText("Mona Ali")).toHaveCount(0);
  await page.getByLabel("Search name or phone").fill("");
  await page.getByTestId("checkin-row").filter({ hasText: "Mona Ali" }).getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("Done").first()).toBeVisible();
  await page.getByTestId("checkin-row").filter({ hasText: "Lina Hassan" }).getByRole("button", { name: "Check in" }).click();
  await expect(page.getByRole("alert")).toContainText("no active plan");
  expect(sent).toEqual(["c1", "c3"]);
});

test("solo: Plans opens on her plans, with classes (monthly), bundles and PT back", async ({ page }) => {
  await boot(page, "solo");
  await page.goto("/");
  await page.getByRole("link", { name: "Plans", exact: true }).click();
  await expect(page).toHaveURL(/\/catalog/);
  for (const t of ["CLASSES", "PLANS", "PT BUNDLES"]) await expect(page.getByRole("button", { name: t })).toBeVisible();
  await expect(page.getByText("Locations", { exact: true })).toBeVisible();
  // Her packages are bundles (a number of classes, valid 1 or 3 months): no unlimited memberships.
  await expect(page.getByText("Memberships", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Packages", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "+ Bundle" }).click();
  await expect(page.getByText("NEW CLASS BUNDLE", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /VALID FOR/ }).click();
  await expect(page.getByRole("button", { name: "1 month" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3 months" })).toBeVisible();
  await expect(page.getByRole("button", { name: "2 months" })).toHaveCount(0);
});

test("solo: Schedule adds a class (no booking counts); Account has no import", async ({ page }) => {
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
  await page.getByRole("button", { name: "Add class" }).click();
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
  await page.getByRole("button", { name: "Quick actions" }).click();
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
  expect(sent).toEqual([{ payMethod: "cash" }]);
});

test("solo drop-in: InstaPay shows her QR before payment is confirmed", async ({ page }) => {
  const sent: unknown[] = [];
  await dropInBoot(page, { dropInPrice: 150, instapayQr: QR }, sent);
  await page.getByRole("button", { name: "InstaPay", exact: true }).click();
  await expect(page.getByAltText("InstaPay QR code")).toBeVisible();
  expect(sent).toEqual([]);
  await page.getByRole("button", { name: "Payment received" }).click();
  await expect(page.getByText("Drop-in recorded")).toBeVisible();
  expect(sent).toEqual([{ payMethod: "instapay" }]);
});

test("solo drop-in: without a price it sends her to Plans to set one", async ({ page }) => {
  await dropInBoot(page, { dropInPrice: null, instapayQr: null }, []);
  await expect(page.getByText("Set your drop-in price first")).toBeVisible();
  await page.getByRole("button", { name: "Go to Plans" }).click();
  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByRole("button", { name: "Set price" })).toBeVisible();
});

test("client list: uses the fast list, and falls back to the main backend if it's down", async ({ page }) => {
  const hits: string[] = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", { __orgMode: "solo", classes: { classes: [] }, revenue: REVENUE });
  const one = { id: "c1", name: "Mona Ali", age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan: null };
  await page.route(/\/functions\/v1\/clients-list\/clients/, (route) => {
    hits.push("fast");
    return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "down" }) });
  });
  await page.route(/\/functions\/v1\/make-server-980e1cbf\/clients$/, (route) => {
    hits.push("main");
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ clients: [one] }) });
  });
  await page.goto("/members");
  await expect(page.getByText("Mona Ali")).toBeVisible();
  expect(hits[0]).toBe("fast");
  expect(hits).toContain("main");
});

test("no caching: reopening a screen always shows the server's latest data", async ({ page }) => {
  let name = "Mona Ali";
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", {
    __orgMode: "solo", classes: { classes: [] }, revenue: REVENUE,
    clients: () => ({ body: { clients: [{ id: "c1", name, age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan: null }] } }),
  });
  await page.goto("/members");
  await expect(page.getByText("Mona Ali")).toBeVisible();
  name = "Mona Samir"; // changed on another phone
  await page.getByRole("link", { name: "Money", exact: true }).click();
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page.getByText("Mona Samir")).toBeVisible();
  await expect(page.getByText("Mona Ali")).toHaveCount(0);
  // Coming back to the app refreshes the open screen too.
  name = "Mona Hassan";
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByText("Mona Hassan")).toBeVisible();
});

test("solo: selling a plan offers only Cash or InstaPay — no card, no wallet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const one = { id: "c1", name: "Mona Ali", age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan: null };
  await mockBackend(page, "dept_head", {
    __orgMode: "solo", classes: { classes: [] }, revenue: REVENUE, clients: { clients: [one] },
    "plan-types": { planTypes: [{ id: "p1", kind: "membership", name: "1 Month", price: 500, durationMonths: 1, credits: null, invitationsAllowance: 0, active: true }] },
  });
  await page.goto("/members");
  await page.getByText("Mona Ali").click();
  await page.getByRole("button", { name: /Sell a plan/ }).first().click();
  await expect(page.getByRole("button", { name: "CASH", exact: true }).or(page.getByRole("radio", { name: /Cash/ })).first()).toBeVisible();
  await expect(page.getByText(/^CARD$|^Card$/)).toHaveCount(0);
  await expect(page.getByText(/^WALLET$/)).toHaveCount(0);
  await expect(page.getByText(/INSTAPAY|InstaPay/).first()).toBeVisible();
});

test("solo FAB: the four quick actions from any tab, also on desktop", async ({ page }) => {
  await boot(page, "solo");
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Quick actions" }).click();
  const qa = page.getByRole("group", { name: "Quick actions" });
  for (const n of ["New client", "Drop-in", "Check in", "Scan PT code"]) await expect(qa.getByRole("button", { name: n })).toBeVisible();
  await qa.getByRole("button", { name: "Check in" }).click();
  await expect(page.getByText("NO SCAN?")).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Quick actions" })).toBeVisible();
});


// ---------- Locations ----------
const LOCS = { locations: [{ id: "L1", name: "Zamalek" }, { id: "L2", name: "Maadi" }] };
const inHours = (h: number) => new Date(Date.now() + h * 3600000).toISOString();

async function bootWithLocations(page: import("@playwright/test").Page, extra: Record<string, unknown> = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", {
    __orgMode: "solo",
    clients: { clients: [] },
    revenue: REVENUE,
    locations: LOCS,
    classes: { classes: [
      { id: "k1", title: "Zamalek Flow", description: null, startsAt: inHours(2), price: 0, status: "active", bookedCount: 3, locationId: "L1" },
      { id: "k2", title: "Maadi Burn", description: null, startsAt: inHours(3), price: 0, status: "active", bookedCount: 1, locationId: "L2" },
    ] },
    ...extra,
  });
}

test("locations: Today switches between her two locations and Coming up follows", async ({ page }) => {
  await bootWithLocations(page);
  await page.goto("/");
  const group = page.getByRole("group", { name: "Working at" });
  await expect(group.getByRole("button", { name: "Zamalek" })).toBeVisible();
  await expect(page.getByText("Zamalek Flow")).toBeVisible();
  await expect(page.getByText("Maadi Burn")).toHaveCount(0);
  await group.getByRole("button", { name: "Maadi" }).click();
  await expect(page.getByText("Maadi Burn")).toBeVisible();
  await expect(page.getByText("Zamalek Flow")).toHaveCount(0);
  // The choice is remembered on this phone and carries to Schedule.
  await page.getByRole("link", { name: "Schedule", exact: true }).click();
  await expect(page.getByText("Maadi Burn")).toBeVisible();
  await expect(page.getByText("Zamalek Flow")).toHaveCount(0);
  // Locations are kept apart: no combined schedule.
  await expect(page.getByRole("button", { name: "All locations" })).toHaveCount(0);
});

test("locations: a new session is created at the location she's working at", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await bootWithLocations(page);
  await page.route("**/functions/v1/make-server-980e1cbf/classes", async (route) => {
    if (route.request().method() === "POST") {
      sent.push(route.request().postDataJSON());
      return route.fulfill({ json: { class: { id: "n1", title: "x", description: null, startsAt: inHours(5), price: 0, status: "active", locationId: "L2" } } });
    }
    return route.fallback();
  });
  await page.goto("/");
  await page.getByRole("group", { name: "Working at" }).getByRole("button", { name: "Maadi" }).click();
  await page.getByRole("link", { name: "Schedule", exact: true }).click();
  await page.getByRole("button", { name: "Add class" }).click();
  await expect(page.getByText("LOCATION", { exact: true })).toBeVisible();
  await page.getByPlaceholder("e.g. Sunrise HIIT").fill("Evening Flow");
  await page.getByRole("button", { name: "Create session" }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0].locationId).toBe("L2");
});

test("locations: check-in tells the backend where it's happening, and the backend has the last word", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  const member = { id: "c1", name: "Mona Ali", age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, homeLocationId: "L1",
    groupPlan: { id: "g1", clientId: "c1", kind: "membership", planTypeId: "p1", seriesId: null, name: "Monthly · Zamalek", priceAtSale: 500, payMethod: "cash", creditsTotal: null, creditsRemaining: null, invitationsRemaining: 0, startsAt: new Date().toISOString(), expiresAt: inHours(24 * 20), status: "active", locationId: "L1" } };
  await bootWithLocations(page, {
    clients: { clients: [member] },
    "check-ins": (b: Record<string, unknown> | null) => { sent.push(b ?? {}); return { status: 400, body: { error: "Mona Ali's Monthly · Zamalek is for Zamalek, not this location.", code: "wrong_location" } }; },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Quick actions" }).click();
  await page.getByRole("group", { name: "Quick actions" }).getByRole("button", { name: "Check in" }).click();
  await page.getByTestId("checkin-row").filter({ hasText: "Mona Ali" }).getByRole("button", { name: "Check in" }).click();
  await expect(page.getByRole("alert")).toContainText("is for Zamalek");
  expect(sent[0]).toMatchObject({ clientId: "c1", locationId: "L1" });
});

test("locations: plans are created for a location, and PT bundles show theirs", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await bootWithLocations(page, {
    "plan-types": (b: Record<string, unknown> | null) => {
      if (b) { sent.push(b); return { body: { planType: { id: "p9", ...b, active: true } } }; }
      return { body: { planTypes: [] } };
    },
    "bundle-types": { bundleTypes: [{ id: "b1", name: "PT 10", price: 3000, sessionsIncluded: 10, expiryDays: 60, locationId: "L2" }] },
  });
  await page.goto("/catalog");
  await page.getByRole("button", { name: "+ Bundle" }).click();
  await page.getByPlaceholder("10-Class Pack").fill("8 Sessions");
  await page.getByRole("spinbutton", { name: "PRICE · EGP" }).fill("800");
  await page.getByRole("spinbutton", { name: "CLASSES INCLUDED" }).fill("8");
  await page.getByRole("button", { name: "Create bundle" }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ kind: "bundle", locationId: "L1" });
  await page.getByRole("button", { name: "PT BUNDLES" }).click();
  // A Maadi PT bundle isn't shown while she's at Zamalek…
  await expect(page.getByText("PT 10")).toHaveCount(0);
  await page.getByRole("group", { name: "Working at" }).getByRole("button", { name: "Maadi" }).click();
  await expect(page.getByText("PT 10")).toBeVisible();
});

test("PT: she sells a PT bundle as the trainer herself and logs today's session", async ({ page }) => {
  const logged: unknown[] = [];
  const pkg = { id: "pk1", clientId: "c1", bundleTypeId: "b1", coachId: "prof-zz", purchaseDate: "2026-10-01", expiryDate: "2026-12-01", sessionsIncluded: 10, sessionsRemaining: 9, priceAtSale: 3000, coachCutAtSale: 0, status: "active", createdBy: "prof-zz", locationId: "L1" };
  const member = { id: "c1", name: "Mona Ali", age: null, phone: "0100", email: null, conditions: null, assignedCoachId: "prof-zz", currentPackage: pkg, currentMembership: null, groupPlan: null, homeLocationId: "L1" };
  await bootWithLocations(page, {
    clients: { clients: [member] },
    "bundle-types": { bundleTypes: [{ id: "b1", name: "PT 10", price: 3000, sessionsIncluded: 10, expiryDays: 60, locationId: "L1" }] },
    "packages/deliver": (b: Record<string, unknown> | null) => { logged.push(b); return { body: { package: { ...pkg, sessionsRemaining: 8 }, preview: {} } }; },
  });
  await page.goto("/members");
  await page.getByText("Mona Ali").click();
  await expect(page.getByText("Location: Zamalek")).toBeVisible();
  await expect(page.getByText(/^Coach:/)).toHaveCount(0);
  await page.getByRole("button", { name: /Log today's PT session/ }).click();
  await expect(page.getByText("PT session logged")).toBeVisible();
  expect(logged).toEqual([{ packageId: "pk1" }]);
});


test("separate locations: each has its own clients; new clients join the location she's at", async ({ page }) => {
  const placed: unknown[] = [];
  const c = (id: string, name: string, loc: string | null) => ({ id, name, age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan: null, homeLocationId: loc });
  await bootWithLocations(page, {
    clients: { clients: [c("c1", "Zainab Zamalek", "L1"), c("c2", "Mariam Maadi", "L2"), c("c3", "Old Client", null)] },
    "plan-types": { planTypes: [
      { id: "pz", kind: "membership", name: "Monthly Z", price: 500, durationMonths: 1, credits: null, invitationsAllowance: 0, active: true, locationId: "L1" },
      { id: "pm", kind: "membership", name: "Monthly M", price: 700, durationMonths: 1, credits: null, invitationsAllowance: 0, active: true, locationId: "L2" },
    ] },
    "clients/location": (b: Record<string, unknown> | null) => { placed.push(b); return { body: { ok: true } }; },
    "group-plans/sell": () => ({ body: { client: c("n1", "New Person", null), plan: {} } }),
    "client-invites": { ok: true },
  });
  await page.goto("/members");
  await expect(page.getByText("Zainab Zamalek")).toBeVisible();
  await expect(page.getByText("Mariam Maadi")).toHaveCount(0);
  // From before locations: shown, flagged so she can place them.
  await expect(page.getByText("Old Client")).toBeVisible();
  await expect(page.getByText("· No location")).toBeVisible();

  await page.getByRole("group", { name: "Working at" }).getByRole("button", { name: "Maadi" }).click();
  await expect(page.getByText("Mariam Maadi")).toBeVisible();
  await expect(page.getByText("Zainab Zamalek")).toHaveCount(0);

  // Selling at Maadi offers Maadi's prices only.
  await page.getByRole("button", { name: "+ New client" }).click();
  await page.getByPlaceholder("Client name").fill("New Person");
  await page.getByPlaceholder("01xxxxxxxxx").fill("01011112222");
  await page.locator('input[type="email"]').fill("new@zztest.dev");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("radio", { name: /Monthly M/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Monthly Z/ })).toHaveCount(0);
});

test("separate locations: Money per location, plus All", async ({ page }) => {
  const asked: string[] = [];
  await bootWithLocations(page);
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
  await page.route("**/payments/summary**", (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const u = new URL(route.request().url());
    const loc = u.searchParams.get("locationId") ?? "all";
    asked.push(loc);
    const total = loc === "L1" ? 500 : loc === "L2" ? 700 : 1200;
    return route.fulfill({ headers: cors, json: { months: 1, total, byMethod: [{ method: "cash", label: "Cash", amount: total, count: 1 }], transfers: [], byMonth: [{ month: "2026-10", revenue: total }] } });
  });
  await page.goto("/money");
  await expect(page.getByText("500", { exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Working at" }).getByRole("button", { name: "Maadi" }).click();
  await expect(page.getByText("700", { exact: true })).toBeVisible();
  await page.getByRole("group", { name: "Working at" }).getByRole("button", { name: "All" }).click();
  await expect(page.getByText("Cash · 1,200")).toBeVisible();
  expect(asked).toEqual(expect.arrayContaining(["L1", "L2", "all"]));
});

test("separate locations: the drop-in charges the location's own price", async ({ page }) => {
  const sent: unknown[] = [];
  await bootWithLocations(page, {
    "org-settings": { dropInPrice: null, dropInPrices: { L1: 150, L2: 200 }, instapayQr: null },
    "drop-ins": (b: Record<string, unknown> | null) => { sent.push(b); return { body: {} }; },
  });
  await page.goto("/");
  await page.getByRole("group", { name: "Working at" }).getByRole("button", { name: "Maadi" }).click();
  await page.getByRole("button", { name: "Quick actions" }).click();
  await page.getByRole("group", { name: "Quick actions" }).getByRole("button", { name: "Drop-in" }).click();
  await expect(page.getByText("200", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await page.getByRole("button", { name: "Cash received" }).click();
  await expect(page.getByText("Drop-in recorded")).toBeVisible();
  expect(sent).toEqual([{ payMethod: "cash", locationId: "L2" }]);
});


test("solo schedule: no bookings, no 'N booked', no roster — a tap edits the class", async ({ page }) => {
  await bootWithLocations(page);
  await page.goto("/bookings");
  await expect(page.getByText("Zamalek Flow")).toBeVisible();
  await expect(page.getByText(/booked|coming/)).toHaveCount(0);
  await page.getByText("Zamalek Flow").click();
  await expect(page.getByText("THIS SESSION ONLY")).toBeVisible();
});

test("solo packages: Kids and Adults show as small labels; PT can have no expiry", async ({ page }) => {
  const sent: Record<string, unknown>[] = [];
  await bootWithLocations(page, {
    "plan-types": { planTypes: [{ id: "p1", kind: "bundle", name: "Kids · 8 classes", price: 3300, durationMonths: 1, credits: 8, invitationsAllowance: 0, active: true, locationId: "L1" }] },
    "bundle-types": (b: Record<string, unknown> | null) => {
      if (b) { sent.push(b); return { body: { bundleType: { id: "b9", ...b } } }; }
      return { body: { bundleTypes: [{ id: "b1", name: "Adults · Personal training", price: 9000, sessionsIncluded: 8, expiryDays: 3650, locationId: "L1" }] } };
    },
  });
  await page.goto("/catalog");
  await expect(page.getByText("Kids", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "PT BUNDLES" }).click();
  await expect(page.getByText("Adults", { exact: true })).toBeVisible();
  await expect(page.getByText(/no expiry/)).toBeVisible();
  await page.getByRole("button", { name: "+ New bundle" }).click();
  await page.getByPlaceholder("24-Session Pack").fill("Kids · Private");
  await page.getByRole("spinbutton", { name: "PRICE · EGP" }).fill("6000");
  await page.getByRole("spinbutton", { name: "SESSIONS INCLUDED" }).fill("8");
  await page.getByRole("button", { name: /Create bundle|Save|Create/ }).last().click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ name: "Kids · Private", expiryDays: 3650, locationId: "L1" });
});

test("solo drop-ins: Kids and Adults each have a price at the location", async ({ page }) => {
  const sent: unknown[] = [];
  await bootWithLocations(page, {
    "org-settings": { dropInPrice: null, dropInPrices: {}, dropInOptions: { L1: [{ label: "Kids", price: 600 }, { label: "Adults", price: 800 }] }, instapayQr: null },
    "drop-ins": (b: Record<string, unknown> | null) => { sent.push(b); return { body: {} }; },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Quick actions" }).click();
  await page.getByRole("group", { name: "Quick actions" }).getByRole("button", { name: "Drop-in" }).click();
  await page.getByRole("button", { name: /Adults/ }).click();
  await expect(page.getByText("800", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await page.getByRole("button", { name: "Cash received" }).click();
  await expect(page.getByText("Drop-in recorded")).toBeVisible();
  expect(sent).toEqual([{ payMethod: "cash", locationId: "L1", label: "Adults" }]);
});

const WAITING = [
  { id: "r1", clientId: "c1", clientName: "Mona Adel", clientPhone: "0100", name: "Adults 8 classes", price: 5000, offerType: "plan_type", createdAt: "2026-10-04T09:30:00Z", proofUrl: null },
  { id: "r2", clientId: "c2", clientName: "Omar Fathy", clientPhone: null, name: "Kids private 8 sessions", price: 6000, offerType: "bundle_type", createdAt: "2026-10-04T10:10:00Z", proofUrl: null },
];

test("InstaPay payments: she sees what's waiting, approves one and rejects one with a reason", async ({ page }) => {
  const calls: string[] = [];
  const bodies: Record<string, unknown>[] = [];
  await bootWithLocations(page, {
    "payment-requests": { requests: WAITING },
    "payment-requests/r1/approve": () => { calls.push("approve r1"); return { body: { ok: true } }; },
    "payment-requests/r2/reject": (b: Record<string, unknown> | null) => { calls.push("reject r2"); bodies.push(b ?? {}); return { body: { ok: true } }; },
  });
  await page.goto("/");
  await page.getByRole("button", { name: /2 payments to approve/ }).click();
  await expect(page.getByText("Mona Adel")).toBeVisible();
  await expect(page.getByText("Omar Fathy")).toBeVisible();
  await page.getByText("Mona Adel").locator("xpath=ancestor::div[.//button[normalize-space()='Approve']][1]").getByRole("button", { name: "Approve" }).click();
  await expect.poll(() => calls).toContain("approve r1");
  await page.getByText("Omar Fathy").locator("xpath=ancestor::div[.//button[normalize-space()='Reject']][1]").getByRole("button", { name: "Reject" }).click();
  await page.getByLabel("TELL THEM WHY (OPTIONAL)").fill("Amount didn't match");
  await page.getByRole("button", { name: "Reject", exact: true }).last().click();
  await expect.poll(() => calls).toContain("reject r2");
  expect(bodies[0]).toMatchObject({ note: "Amount didn't match" });
});

test("InstaPay payments: nothing waiting shows no card; she can set her InstaPay address", async ({ page }) => {
  const sent: unknown[] = [];
  await bootWithLocations(page, {
    "payment-requests": { requests: [] },
    "org-settings": (b: Record<string, unknown> | null) => {
      if (b) { sent.push(b); return { body: { ok: true } }; }
      return { body: { dropInPrice: null, dropInPrices: {}, dropInOptions: {}, instapayQr: null, instapayAddress: null } };
    },
  });
  await page.goto("/");
  await expect(page.getByText(/to approve/)).toHaveCount(0);
  await page.goto("/catalog");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("INSTAPAY ADDRESS").fill("hh@instapay");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ instapayAddress: "hh@instapay" });
});

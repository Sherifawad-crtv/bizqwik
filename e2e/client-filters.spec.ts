import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";
import { filterClients, NO_FILTERS, planFacts } from "../src/lib/clientFilters";

// The founder's Clients tab: find people by name, status, plan, expiry date or
// coach — "who runs out this week", "who needs to renew", "everyone on 20 Sessions".

const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const plan = (cid: string, kind: string, name: string, end: number, credits?: [number, number], status = "active") => ({
  id: "gp" + cid, clientId: cid, kind, planTypeId: null, seriesId: null, name, priceAtSale: 800, payMethod: "cash",
  creditsTotal: credits ? credits[1] : null, creditsRemaining: credits ? credits[0] : null, invitationsRemaining: 0,
  startsAt: days(-40), expiresAt: days(end), status });
const c = (id: string, name: string, gp: unknown, coach: string | null, last: unknown = null) => ({
  id, name, age: null, phone: "0100555" + id, email: null, conditions: null, assignedCoachId: coach,
  currentPackage: null, currentMembership: null, groupPlan: gp, lastGroupPlan: last });
const CLIENTS = [
  c("a1", "Adam Tantawy", plan("a1", "bundle", "10 Sessions", 5, [1, 10]), "c1"),
  c("a2", "Hana Mostafa", plan("a2", "bundle", "20 Sessions", 25, [15, 20]), "c1"),
  c("a3", "Omar Fathy", plan("a3", "membership", "PT - 6 Weeks", 40), "c2"),
  c("a4", "Yara Essam", plan("a4", "bundle", "20 Sessions", 3, [12, 20]), "c2"),
  c("a5", "Mahmoud Ali", null, null, plan("a5", "bundle", "10 Sessions", -3, [4, 10], "finished")),
  c("a6", "Laila Hassan", null, "c1"),
  c("a7", "Karim Soliman", plan("a7", "bundle", "60 Sessions", 60, [45, 60]), "c1"),
];

async function boot(page: Page, width = 1200) {
  await page.setViewportSize({ width, height: 900 });
  await mockBackend(page, "dept_head", {
    clients: { clients: CLIENTS },
    [`month/${new Date().toISOString().slice(0, 7)}`]: { rows: [{ coachId: "c1", name: "Mohamed Hesham", role: "coach" }, { coachId: "c2", name: "Nour Adel", role: "coach" }] },
  });
}
const pick = async (page: Page, label: string, option: string) => {
  await page.getByTestId("client-filters").getByRole("button", { name: new RegExp(label) }).click();
  await page.getByRole("button", { name: option, exact: true }).click();
};

test("filters: status, plan, expiry and search narrow the roster, and clear brings everyone back", async ({ page }) => {
  await boot(page);
  await page.goto("/clients");
  await expect(page.getByTestId("roster-count")).toHaveText("7 clients");

  await pick(page, "STATUS", "Ended · needs renewal");
  await expect(page.getByTestId("roster-count")).toHaveText("1 of 7 clients");
  await expect(page.getByText("Mahmoud Ali")).toBeVisible();
  await expect(page.getByTestId("status-pill")).toHaveText("EXPIRED");

  await page.getByRole("button", { name: "Clear filters" }).click();
  await pick(page, "PLAN", "20 Sessions · 2");
  await expect(page.getByTestId("roster-count")).toHaveText("2 of 7 clients");
  await pick(page, "EXPIRES", "Next 7 days");
  await expect(page.getByTestId("roster-count")).toHaveText("1 of 7 clients");
  await expect(page.getByText("Yara Essam")).toBeVisible();
  await expect(page.getByText("Hana Mostafa")).toHaveCount(0);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("SEARCH").fill("0100555a3");
  await expect(page.getByTestId("roster-count")).toHaveText("1 of 7 clients");
  await expect(page.getByText("Omar Fathy")).toBeVisible();
});

test("filters: the summary cards count real plans and open the matching list when tapped", async ({ page }) => {
  await boot(page);
  await page.goto("/clients");
  await expect(page.getByRole("button", { name: /^NEEDS RENEWAL 1$/ })).toBeVisible();
  await page.getByRole("button", { name: /^EXPIRING SOON/ }).click();
  await expect(page.getByTestId("roster-count")).toHaveText("2 of 7 clients");
  await expect(page.getByText("Adam Tantawy")).toBeVisible();
  await expect(page.getByText("Yara Essam")).toBeVisible();
});

test("filters: nothing matching says so, and offers the way out", async ({ page }) => {
  await boot(page);
  await page.goto("/clients");
  await page.getByLabel("SEARCH").fill("zzzz");
  await expect(page.getByText("No clients match")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByTestId("roster-count")).toHaveText("7 clients");
});

test("filters: coach and sorting, on a phone", async ({ page }) => {
  await boot(page, 390);
  await page.goto("/clients");
  await pick(page, "COACH", "Nour Adel");
  await expect(page.getByTestId("roster-count")).toHaveText("2 of 7 clients");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await pick(page, "COACH", "Unassigned");
  await expect(page.getByText("Mahmoud Ali")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await pick(page, "SORT BY", "Expiry · soonest");
  const order = await page.locator("[data-sq]", { hasText: /Tantawy|Essam|Mostafa/ }).allTextContents();
  expect(order.length).toBeGreaterThan(0);
  await expect(page.getByTestId("client-filters")).toBeVisible();
  await page.mouse.click(10, 10);
  await page.getByTestId("client-filters").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/filters-phone.png", fullPage: false });
});

test("filters (logic): sorting by expiry and sessions left puts people without a date last", async () => {
  const now = Date.now();
  const byExpiry = filterClients(CLIENTS as never, { ...NO_FILTERS, sort: "expiry" }, now).map((x) => x.name);
  expect(byExpiry.slice(0, 3)).toEqual(["Mahmoud Ali", "Yara Essam", "Adam Tantawy"]);
  expect(byExpiry[byExpiry.length - 1]).toBe("Laila Hassan");
  const byLeft = filterClients(CLIENTS as never, { ...NO_FILTERS, sort: "left" }, now).map((x) => x.name);
  expect(byLeft.slice(0, 2)).toEqual(["Adam Tantawy", "Yara Essam"]);
  const low = filterClients(CLIENTS as never, { ...NO_FILTERS, status: "low" }, now).map((x) => x.name);
  expect(low).toEqual(["Adam Tantawy"]);
  expect(planFacts(CLIENTS[4] as never, now).state).toBe("ended");
  const custom = filterClients(CLIENTS as never, { ...NO_FILTERS, expiry: "custom", from: new Date(now + 20 * 86400000).toISOString().slice(0, 10), to: new Date(now + 45 * 86400000).toISOString().slice(0, 10) }, now).map((x) => x.name);
  expect(custom).toEqual(["Hana Mostafa", "Omar Fathy"]);
});

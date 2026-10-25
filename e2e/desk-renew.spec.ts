import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// Someone who can't check in (expired, no sessions left) is sold what they need
// from the check-in sheet itself — the same flow as their client page — and then
// checked in, without leaving or searching again.

const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const ended = {
  id: "gp-old", clientId: "e1", kind: "bundle", planTypeId: "pt-20", seriesId: null, name: "20 Sessions", priceAtSale: 3000, payMethod: "cash",
  creditsTotal: 20, creditsRemaining: 4, invitationsRemaining: 0, startsAt: days(-70), expiresAt: days(-3), status: "finished" };
const renewed = { ...ended, id: "gp-new", creditsRemaining: 20, startsAt: days(0), expiresAt: days(60), status: "active" };
const person = (groupPlan: unknown, lastGroupPlan: unknown) => ({
  id: "e1", name: "Momen Khaled", age: null, phone: "0100555001", email: null, conditions: null, assignedCoachId: null,
  currentPackage: null, currentMembership: null, groupPlan, lastGroupPlan });
const PLAN_TYPES = [
  { id: "pt-10", kind: "bundle", name: "10 Sessions", price: 1800, durationMonths: 1, credits: 10, invitationsAllowance: 0, active: true },
  { id: "pt-20", kind: "bundle", name: "20 Sessions", price: 3000, durationMonths: 2, credits: 20, invitationsAllowance: 0, active: true },
];

async function boot(page: Page, sold: { body: unknown }[]) {
  await page.setViewportSize({ width: 390, height: 844 });
  let isRenewed = false;
  await mockBackend(page, "front_desk", {
    "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] },
    clients: () => ({ body: { clients: [isRenewed ? person(renewed, null) : person(null, ended)] } }),
    "plan-types": { planTypes: PLAN_TYPES },
    "class-series": { series: [] },
    classes: { classes: [] },
    "bundle-types": { bundleTypes: [{ id: "b1", name: "8 PT Sessions", price: 2400, sessionsIncluded: 8, expiryDays: 60 }] },
    coaches: { coaches: [{ id: "c1", name: "Karim Adel", avatarUrl: null }] },
    "group-plans/sell": (body: unknown) => {
      sold.push({ body });
      isRenewed = true;
      return { body: { client: person(renewed, null), plan: renewed } };
    },
    "check-ins": { checkIn: { id: "ci1" }, deducted: true, plan: { name: "20 Sessions", kind: "bundle", creditsRemaining: 19, creditsTotal: 20 } },
  });
}

test("desk: an expired client is offered a renewal, not only a drop-in", async ({ page }) => {
  await boot(page, []);
  await page.goto("/");
  await page.getByLabel("Find a client by name or phone").fill("Momen");
  await page.getByTestId("home-result").filter({ hasText: "Momen Khaled" }).getByRole("button", { name: "Options" }).click();
  await expect(page.getByText("Ended", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("renew-plan")).toHaveText("Renew plan");
  await expect(page.getByTestId("sell-pt")).toHaveText("Sell a PT package");
  await expect(page.getByRole("button", { name: "Sell a drop-in pass" })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/desk-renew.png" });
});

test("desk: renewing from the check-in sheet starts on their last plan, then checks them in", async ({ page }) => {
  const sold: { body: unknown }[] = [];
  await boot(page, sold);
  await page.goto("/");
  await page.getByLabel("Find a client by name or phone").fill("Momen");
  await page.getByTestId("home-result").filter({ hasText: "Momen Khaled" }).getByRole("button", { name: "Options" }).click();
  await page.getByTestId("renew-plan").click();

  // The plan picker opens with what they had last already chosen.
  await expect(page.getByText("Choose a plan")).toBeVisible();
  await expect(page.getByText(/20 Sessions · 3,?000 EGP/)).toBeVisible();
  await page.getByRole("button", { name: "Start plan" }).click();
  expect(sold).toHaveLength(1);
  expect(sold[0].body).toMatchObject({ clientId: "e1", planTypeId: "pt-20", payMethod: "cash" });

  // Straight back to the check-in, now with a live plan.
  await expect(page.getByRole("button", { name: "Confirm check-in" })).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId("renew-plan")).toHaveCount(0);
});

test("desk: a frozen member is not offered a new plan", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const frozen = { ...renewed, creditsRemaining: 10, frozenUntil: days(5) };
  await mockBackend(page, "front_desk", {
    "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] },
    clients: { clients: [person(frozen, null)] },
    "plan-types": { planTypes: PLAN_TYPES }, "class-series": { series: [] }, classes: { classes: [] },
    "bundle-types": { bundleTypes: [] }, coaches: { coaches: [] },
  });
  await page.goto("/");
  await page.getByLabel("Find a client by name or phone").fill("Momen");
  await page.getByTestId("home-result").filter({ hasText: "Momen Khaled" }).getByRole("button", { name: "Options" }).click();
  await expect(page.getByText(/frozen until/)).toBeVisible();
  await expect(page.getByTestId("renew-plan")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sell a drop-in pass" })).toBeVisible();
});

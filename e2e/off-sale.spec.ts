import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// Plans and PT packages taken off sale are gone from the founder's lists (people
// who hold one keep it).

const PLAN_TYPES = [
  { id: "m1", kind: "membership", name: "Calisthenics - 1 Month", price: 2800, durationMonths: 1, credits: null, invitationsAllowance: 0, active: true },
  { id: "m2", kind: "membership", name: "Old 12 Months", price: 33600, durationMonths: 12, credits: null, invitationsAllowance: 0, active: false },
];
const BUNDLES = [
  { id: "b1", name: "PT - 10 Sessions", price: 4000, sessionsIncluded: 10, expiryDays: 30, active: true },
  { id: "b2", name: "PT 6 Weeks shared", price: 0, sessionsIncluded: 30, expiryDays: 42, active: false },
];

test("catalog: plans and PT packages taken off sale don't show", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", { "plan-types": { planTypes: PLAN_TYPES }, "class-series": { series: [] }, "bundle-types": { bundleTypes: BUNDLES } });
  await page.goto("/catalog");
  await page.getByRole("button", { name: "PLANS" }).click();
  await expect(page.getByText("Calisthenics - 1 Month")).toBeVisible();
  await expect(page.getByText("Old 12 Months")).toHaveCount(0);
  await expect(page.getByText(/off-sale/i)).toHaveCount(0);

  await page.getByRole("button", { name: "PT BUNDLES" }).click();
  await expect(page.getByText("PT - 10 Sessions")).toBeVisible();
  await expect(page.getByText("PT 6 Weeks shared")).toHaveCount(0);
});

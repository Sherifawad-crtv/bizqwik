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
  });
}

test("solo owner: four tabs, the desk as home, and no team tools", async ({ page }) => {
  await boot(page, "solo");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Check someone in" })).toBeVisible();
  for (const l of ["Today", "Members", "Schedule", "Money"]) await expect(page.getByRole("link", { name: l, exact: true })).toBeVisible();
  for (const l of ["Team", "Catalog", "History", "Overview"]) await expect(page.getByRole("link", { name: l, exact: true })).toHaveCount(0);
});

test("solo owner: Money shows revenue, how it was paid, and the InstaPay transfers", async ({ page }) => {
  await boot(page, "solo");
  await page.goto("/");
  await page.getByRole("link", { name: "Money", exact: true }).click();
  await expect(page).toHaveURL(/\/money$/);
  await expect(page.getByText("3,500").first()).toBeVisible();
  await expect(page.getByText("InstaPay", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("2,500")).toBeVisible();
  await expect(page.getByText("Mona Ali")).toBeVisible();
});

test("team owner is unchanged: Overview home with the full roster of tabs", async ({ page }) => {
  await boot(page, "team");
  await page.goto("/");
  await expect(page).toHaveURL(/\/oversight$/);
  await expect(page.getByRole("link", { name: "Team", exact: true })).toBeVisible();
});

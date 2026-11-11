import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// How screens move, the iOS way: tabs are peers (a fade), going deeper slides in,
// going back slides away, and tapping a tab while deep is a fade, not a "back".

const now = new Date();
const THIS = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const row = (id: string, name: string) => ({ coachId: id, name, email: `${id}@x.com`, role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 250, count: 4, groupTotal: 1000, privateTotal: 0, packageCount: 0, total: 1000, state: "settled", settledAt: "2026-10-30T10:00:00Z", paidAt: null, paidAmount: 0, remaining: 1000 });
const REVENUE = { months: [], totals: { revenue: 0, payouts: 0, profit: 0 }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 0, groupPlans: 0, ptPackages: 0, byPlanKind: {} }, walletLiability: 0 };
const PNL = { month: THIS, current: { month: THIS, grossRevenue: 0, refunds: 0, netRevenue: 0, coachPayouts: 0, otherExpenses: 0, totalExpenses: 0, profit: 0 }, trend: [], revenueBySource: [], expensesBySource: [], hasPastExpenses: false, unsettledNote: null };

async function boot(page: Page, role: "dept_head" | "accountant") {
  await page.setViewportSize({ width: 390, height: 844 });
  // Every earlier month of the year answers too (empty), as the real backend does.
  const earlier: Record<string, unknown> = {};
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    if (d.getFullYear() === now.getFullYear()) earlier[`month/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { rows: [] };
  }
  await mockBackend(page, role, {
    ...earlier,
    revenue: REVENUE,
    [`month/${THIS}`]: { rows: [row("c1", "Coach Nour")] },
    [`sessions/c1/${THIS}`]: { sessions: [] }, [`packages/by-coach/c1/${THIS}`]: { packages: [] },
    "accounting/pnl": PNL, "accounting/categories": { categories: [] }, "accounting/expenses": { expenses: [] }, "accounting/recurring": { recurring: [] },
    "pay/payments": { payments: [] },
  });
}
// The sideways offsets of every screen layer, a moment after the tap.
const offsets = async (page: Page) => {
  await page.waitForTimeout(70);
  return page.evaluate(() => [...document.querySelectorAll("main [data-scroll]")].map((el) => {
    const t = getComputedStyle(el).transform;
    return t === "none" ? 0 : new DOMMatrixReadOnly(t).m41;
  }));
};
const slides = (xs: number[]) => xs.some((x) => x > 20) || xs.some((x) => x < -20);
const settle = (page: Page) => page.waitForTimeout(500);

test("tabs are peers: switching between them fades, nothing slides", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.getByRole("link", { name: "Team" }).click();
  expect(slides(await offsets(page))).toBe(false);
  await settle(page);
  await page.getByRole("link", { name: "Catalog" }).click();
  expect(slides(await offsets(page))).toBe(false);
});

test("going deeper slides in; going back slides away", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/coaches"); await page.waitForTimeout(1200);
  await page.getByText("Coach Nour").click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/coaches\/c1$/);
  await settle(page);
  await page.getByRole("button", { name: /Team/ }).first().click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/coaches$/);
});

test("a screen reached from a card (Accounting from Overview) slides in like any other level down", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.getByText("Profit & loss").click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/accounting$/);
});

test("the payee page slides in from the To Pay list (it was fading before)", async ({ page }) => {
  await boot(page, "accountant");
  await page.goto("/pay"); await page.waitForTimeout(1200);
  await page.getByText("Coach Nour").first().click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/pay\/c1$/);
});

test("settings go deeper in two steps, each sliding in", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.getByRole("link", { name: "Account" }).click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/account$/);
  await settle(page);
  await page.getByText("Account Settings").click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/account\/profile$/);
});

test("tapping a tab while a level deep fades, it does not play a back slide", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.getByText("Profit & loss").click();
  await settle(page);
  await expect(page).toHaveURL(/\/accounting$/);
  await page.getByRole("link", { name: "Team" }).click();
  expect(slides(await offsets(page))).toBe(false);
  await expect(page).toHaveURL(/\/coaches$/);
});

test("the back button on a deeper screen slides it away to the right", async ({ page }) => {
  await boot(page, "accountant");
  await page.goto("/pay"); await page.waitForTimeout(1200);
  await page.getByText("Coach Nour").first().click();
  await settle(page);
  await page.getByRole("button", { name: /To Pay/ }).click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/pay$/);
});

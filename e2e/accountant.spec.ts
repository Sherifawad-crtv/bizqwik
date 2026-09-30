import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

const now = new Date();
const ym = (back: number) => {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const THIS = ym(0);
const LAST = ym(1);
const row = (id: string, name: string, state: string, total: number, extra: Record<string, unknown> = {}) => ({
  coachId: id, name, email: `${id}@x.com`, role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 150, count: 4,
  groupTotal: total, privateTotal: 0, packageCount: 0, total, state, settledAt: state === "logging" ? null : "2026-08-30T10:00:00Z", paidAt: state === "paid" ? "2026-09-02T10:00:00Z" : null, ...extra,
});
const REVENUE = {
  months: [{ month: THIS, revenue: 9000, payouts: 3000, profit: 6000 }],
  totals: { revenue: 9000, payouts: 3000, profit: 6000 },
  byService: [{ key: "group", label: "Group training", amount: 9000 }], byType: [{ key: "membership", label: "Memberships", amount: 9000 }], byCoach: [],
  activeSubscribers: { total: 3, groupPlans: 3, ptPackages: 0, byPlanKind: {} }, walletLiability: 500,
};
const ACTIVITY = {
  activity: [
    { id: "a1", type: "sale_plan", amount: 4000, clientName: "Nour", meta: { name: "1 Month", payMethod: "cash" }, at: "2026-09-10T10:00:00Z" },
    { id: "a2", type: "refund_desk", amount: 300, clientName: "Omar", meta: {}, at: "2026-09-11T10:00:00Z" },
    { id: "a3", type: "check_in", amount: null, clientName: "Nour", meta: {}, at: "2026-09-12T10:00:00Z" },
    { id: "a4", type: "wallet_compensation", amount: 100, clientName: "Omar", meta: {}, at: "2026-09-13T10:00:00Z" },
  ],
};

async function boot(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  // Every earlier month of the year answers too (empty), as the real backend does.
  const earlier: Record<string, unknown> = {};
  for (let i = 2; i <= 12; i++) if (ym(i).slice(0, 4) === THIS.slice(0, 4)) earlier[`month/${ym(i)}`] = { rows: [] };
  await mockBackend(page, "accountant", {
    ...earlier,
    [`month/${THIS}`]: { rows: [row("c1", "Coach Nour", "settled", 1200), row("c2", "Coach Omar", "paid", 900), row("c3", "Coach Lina", "logging", 600)] },
    [`month/${LAST}`]: { rows: [row("c1", "Coach Nour", "settled", 2000)] },
    [`packages/by-coach/c2/${THIS}`]: { packages: [] },
    [`packages/by-coach/c1/${THIS}`]: { packages: [] },
    revenue: REVENUE,
    activity: ACTIVITY,
  });
}

test("accountant: To Pay shows what is owed from every month, and where this month stands", async ({ page }) => {
  await boot(page);
  await page.goto("/pay");
  await expect(page.getByText("DUE NOW · EGP")).toBeVisible();
  await expect(page.getByText("3,200").first()).toBeVisible(); // 1,200 this month + 2,000 still owed from last month
  await expect(page.getByText("Ready to pay")).toBeVisible();
  await expect(page.getByText("Still logging")).toBeVisible();
  await expect(page.getByText("2 due")).toBeVisible();
});

test("accountant: revenue and every money transaction are on hand", async ({ page }) => {
  await boot(page);
  await page.goto("/pay");
  await page.getByRole("button", { name: "Revenue" }).or(page.getByRole("link", { name: "Revenue" })).first().click();
  await expect(page).toHaveURL(/\/revenue$/);
  await expect(page.getByText("REVENUE · EGP")).toBeVisible();
  await expect(page.getByText("9,000").first()).toBeVisible();

  await page.getByRole("button", { name: "Money" }).or(page.getByRole("link", { name: "Money" })).first().click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByText("Nour bought 1 Month")).toBeVisible();
  await expect(page.getByText("Omar was refunded")).toBeVisible();
  await expect(page.getByText("Nour checked in")).toHaveCount(0); // not money
  await page.getByRole("button", { name: "REFUNDS" }).click();
  await expect(page.getByText("Nour bought 1 Month")).toHaveCount(0);
});

test("accountant: history rows open a receipt with the payment record", async ({ page }) => {
  await boot(page);
  await page.goto("/history");
  await expect(page.getByText("YEAR TO DATE")).toBeVisible();
  await page.getByText("Coach Omar").click();
  await expect(page).toHaveURL(/\/pay\/c2$/);
  await expect(page.getByText("PAYMENT RECORD")).toBeVisible();
  await expect(page.getByText("Not paid yet")).toHaveCount(0);
});

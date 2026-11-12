import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

test("launch: the full logo and a spinner show first, then the app", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head");
  await page.goto("/");
  const splash = page.getByTestId("splash");
  await expect(splash).toBeVisible();
  await expect(splash.getByRole("img", { name: "Bizqwik" })).toHaveAttribute("src", "/wordmark.png");
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/79d812ed-04bd-5f9f-b39f-4aff3ec4e347/scratchpad/splash.png" });
  await expect(splash).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Team", exact: true })).toBeVisible();
});

test("launch: it shows once per launch, not on every screen change", async ({ page }) => {
  await mockBackend(page, "dept_head");
  await page.goto("/");
  await expect(page.getByTestId("splash")).toHaveCount(0);
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page.getByTestId("splash")).toHaveCount(0);
});

test("launch: a slow overview doesn't hold the logo — the splash lifts, placeholders show, then the numbers settle in (one request)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const m = new Date();
  const month = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
  await mockBackend(page, "dept_head", {
    revenue: {
      months: [{ month, revenue: 5000, payouts: 2000, profit: 3000 }],
      totals: { revenue: 5000, payouts: 2000, profit: 3000 },
      byService: [], byType: [], byCoach: [],
      activeSubscribers: { total: 3, groupPlans: 3, ptPackages: 0, byPlanKind: {} }, walletLiability: 0,
    },
  });
  const calls: string[] = [];
  // Registered after the mock, so it sees the request first: hold the answer, then hand it on.
  await page.route(/\/revenue\?/, async (route) => {
    if (route.request().method() !== "OPTIONS") calls.push(route.request().url());
    await new Promise((r) => setTimeout(r, 2500));
    await route.fallback();
  });
  await page.goto("/");
  const splash = page.getByTestId("splash");
  await expect(splash).toBeVisible();
  // The logo goes after a moment even though the numbers are still on their way...
  await expect(splash).toHaveCount(0, { timeout: 1800 });
  // ...and the screen shows the shape of what's coming, not a blank or a spinner.
  await expect(page.getByTestId("skeleton").first()).toBeVisible();
  await expect(page.getByText("REVENUE VS COACH PAYOUTS")).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId("skeleton")).toHaveCount(0);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("history=24");
});

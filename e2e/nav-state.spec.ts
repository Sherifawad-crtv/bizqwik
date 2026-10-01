import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

const now = new Date();
const ym = (back: number) => {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const THIS = ym(0);
const LAST = ym(1);
const row = (total: number) => ({
  coachId: "c1", name: "Coach Nour", email: "c1@x.com", role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 150, count: 4,
  groupTotal: total, privateTotal: 0, packageCount: 0, total, state: "settled", settledAt: "2026-08-30T10:00:00Z", paidAt: null,
});

test.skip(now.getMonth() === 0, "needs an earlier month in the same year");

async function boot(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", {
    [`month/${THIS}`]: { rows: [row(1200)] },
    [`month/${LAST}`]: { rows: [row(2000)] },
    [`sessions/c1/${THIS}`]: { sessions: [] },
    [`sessions/c1/${LAST}`]: { sessions: [] },
    [`packages/by-coach/c1/${THIS}`]: { packages: [] },
    [`packages/by-coach/c1/${LAST}`]: { packages: [] },
    activity: { activity: [] },
  });
}

test("dept head: History keeps the chosen month when you open a coach and come back", async ({ page }) => {
  await boot(page);
  await page.goto("/history");
  await page.getByRole("button", { name: new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString("en", { month: "short" }), exact: false }).first().click();
  await expect(page).toHaveURL(new RegExp(`month=${LAST}`));
  await expect(page.getByText("2,000").first()).toBeVisible();

  await page.getByText("Coach Nour").first().click();
  await expect(page).toHaveURL(/\/coaches\/c1$/);
  await expect(page.getByRole("button", { name: "History" })).toBeVisible();
  await page.getByRole("button", { name: "History" }).click();

  await expect(page).toHaveURL(/\/history/);
  await expect(page).toHaveURL(new RegExp(`month=${LAST}`));
  await expect(page.getByText("2,000").first()).toBeVisible();
});

test("dept head: Back from a coach opened on Team returns to Team", async ({ page }) => {
  await boot(page);
  await page.goto("/coaches");
  await page.getByText("Coach Nour").first().click();
  await expect(page.getByRole("button", { name: "Team" }).last()).toBeVisible();
  await page.getByRole("button", { name: "Team" }).last().click();
  await expect(page).toHaveURL(/\/coaches$/);
});

test("dept head: a tab's choices survive switching tabs", async ({ page }) => {
  await boot(page);
  await page.goto("/history");
  await page.getByRole("button", { name: "ACTIVITY", exact: true }).click();
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.getByRole("button", { name: "ACTIVITY", exact: true })).toHaveAttribute("aria-pressed", "true");
});

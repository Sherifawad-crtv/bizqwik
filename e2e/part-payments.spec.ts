import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// A settled month can be paid in parts (e.g. group sessions first, PT later).
// The accountant records each payment; the month turns paid when they add up.

const now = new Date();
const THIS = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const row = (paidAmount: number) => ({
  coachId: "c1", name: "Abdelrahman Ahmed", email: "a@x.com", role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 250, count: 18,
  groupTotal: 4500, privateTotal: 4560, packageCount: 6, total: 9060, state: paidAmount >= 9060 ? "paid" : "settled",
  settledAt: "2026-11-01T10:00:00Z", paidAt: paidAmount >= 9060 ? "2026-11-02T10:00:00Z" : null,
  paidAmount, remaining: Math.max(0, 9060 - paidAmount),
});

async function boot(page: Page, paid: { v: number }, payments: unknown[], posted: Record<string, unknown>[]) {
  await page.setViewportSize({ width: 390, height: 844 });
  // Every earlier month of the year answers too (empty), as the real backend does.
  const earlier: Record<string, unknown> = {};
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    if (d.getFullYear() === now.getFullYear()) earlier[`month/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { rows: [] };
  }
  await mockBackend(page, "accountant", {
    ...earlier,
    [`month/${THIS}`]: () => ({ body: { rows: [row(paid.v)] } }),
    [`packages/by-coach/c1/${THIS}`]: { packages: [] },
    "pay/payments": () => ({ body: { payments } }),
    pay: (b: Record<string, unknown> | null) => {
      posted.push(b ?? {});
      paid.v += Number(b?.amount ?? 0);
      return { body: { paidAmount: paid.v, remaining: 9060 - paid.v } };
    },
    revenue: { months: [], totals: { revenue: 0, payouts: 0, profit: 0 }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 0, groupPlans: 0, ptPackages: 0, byPlanKind: {} }, walletLiability: 0 },
  });
}

test("part payments: the queue shows what's left and how much is already paid", async ({ page }) => {
  await boot(page, { v: 4500 }, [], []);
  await page.goto("/pay");
  await expect(page.getByText("PART PAID · 4,500 OF 9,060")).toBeVisible();
  await expect(page.getByText("4,560").first()).toBeVisible(); // still due
  await expect(page.getByText("Still to pay")).toBeVisible();
});

test("part payments: pay the group part first, then see it listed", async ({ page }) => {
  const posted: Record<string, unknown>[] = [];
  const paid = { v: 0 };
  const payments: unknown[] = [];
  await boot(page, paid, payments, posted);
  await page.goto(`/pay/c1`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => history.replaceState({ month: undefined }, ""));
  await page.getByRole("button", { name: /Record payment/ }).first().click();

  // Quick amounts for the two parts, and the rest of the month.
  await expect(page.getByRole("button", { name: "Group 4,500" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Private 4,560" })).toBeVisible();
  await page.getByRole("button", { name: "Group 4,500" }).click();
  await page.getByRole("button", { name: "BANK" }).click();
  await page.getByLabel("NOTE (OPTIONAL)").fill("group sessions");
  await expect(page.getByText("4,560 EGP will still be left to pay.")).toBeVisible();
  payments.push({ id: "p1", amount: 4500, paidOn: today, method: "bank", note: "group sessions", paidBy: "me", createdAt: new Date().toISOString() });
  await page.getByRole("button", { name: /Record payment · 4,500 EGP/ }).click();

  expect(posted).toHaveLength(1);
  expect(posted[0]).toMatchObject({ coachId: "c1", amount: 4500, method: "bank", note: "group sessions", date: today });
  await expect(page.getByText("Paid · 4,560 EGP left")).toBeVisible();
});

test("part payments: can't pay more than what's left", async ({ page }) => {
  const posted: Record<string, unknown>[] = [];
  await boot(page, { v: 4500 }, [], posted);
  await page.goto(`/pay/c1`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Record another payment/ }).click();
  await page.getByLabel("AMOUNT (EGP)").fill("5000");
  await page.getByRole("button", { name: /Record payment/ }).last().click();
  await expect(page.getByText("Only 4,560 EGP is left to pay.")).toBeVisible();
  expect(posted).toHaveLength(0);
});

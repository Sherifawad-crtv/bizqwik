import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// Accounting v1: profit & loss, expenses, recurring expenses. Owner and
// accountant only; coach payouts are read-only here (settled amounts, from
// /pay); the P&L's revenue reuses the dashboard's own figure, less refunds.

const now = new Date();
const ym = (back: number) => {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const THIS = ym(0);
const LAST = ym(1);

const CATEGORIES = [
  { id: "cat-rent", name: "Rent", sortOrder: 1, isDefault: true, archived: false },
  { id: "cat-sal", name: "Salaries", sortOrder: 2, isDefault: true, archived: false },
  { id: "cat-util", name: "Utilities", sortOrder: 3, isDefault: true, archived: false },
];
const EXPENSES = [
  { id: "e1", categoryId: "cat-rent", categoryName: "Rent", amount: 12000, date: `${THIS}-01`, note: "October rent", hasReceipt: false, receiptUrl: null, recurringId: null, createdBy: "me", editedAfterMonthEnd: false },
  { id: "e2", categoryId: "cat-util", categoryName: "Utilities", amount: 1500, date: `${THIS}-05`, note: "Electricity", hasReceipt: true, receiptUrl: "https://example.com/r.jpg", recurringId: null, createdBy: "me", editedAfterMonthEnd: false },
];
const RECURRING = [
  { id: "r1", categoryId: "cat-rent", categoryName: "Rent", amount: 12000, note: null, dayOfMonth: 1, startMonth: ym(3), endMonth: null, active: true },
];
const PNL = {
  month: THIS,
  current: { month: THIS, grossRevenue: 20000, refunds: 1000, netRevenue: 19000, coachPayouts: 4000, otherExpenses: 13500, totalExpenses: 17500, profit: 1500 },
  trend: [LAST, THIS].map((m, i) => ({
    month: m, grossRevenue: 18000 + i * 2000, refunds: i === 1 ? 1000 : 0, netRevenue: i === 1 ? 19000 : 18000,
    coachPayouts: 4000, otherExpenses: i === 1 ? 13500 : 12000, totalExpenses: i === 1 ? 17500 : 16000, profit: i === 1 ? 1500 : 2000,
  })),
  revenueBySource: [{ key: "group", label: "Group training", amount: 15000 }, { key: "private_training", label: "Private training", amount: 4000 }],
  expensesBySource: [{ key: "coach_payouts", label: "Coach payouts", amount: 4000 }, { key: "cat-rent", label: "Rent", amount: 12000 }, { key: "cat-util", label: "Utilities", amount: 1500 }],
  hasPastExpenses: true,
  unsettledNote: { count: 2 },
};


// The option inside the open "Choose one" picker (not a same-named chip on the page behind it).
const pickOption = (page: Page, name: string) =>
  page.getByText("Choose one").locator("xpath=following-sibling::div[1]").getByRole("button", { name, exact: true }).click();

async function boot(page: Page, role: "dept_head" | "accountant" | "coach" | "front_desk", extra: Record<string, unknown> = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, role, {
    "accounting/categories": { categories: CATEGORIES },
    "accounting/expenses": { expenses: EXPENSES }, // mocks match by path only; the real endpoint reads ?month= itself
    "accounting/recurring": { recurring: RECURRING },
    "accounting/pnl": PNL,
    revenue: { months: [{ month: THIS, revenue: 20000, payouts: 4000, profit: 16000 }], totals: { revenue: 20000, payouts: 4000, profit: 16000 }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 5, groupPlans: 5, ptPackages: 0, byPlanKind: {} }, walletLiability: 0 },
    [`month/${THIS}`]: { rows: [] },
    ...extra,
  });
}

test("accounting: accountant has a 5th tab and sees the P&L", async ({ page }) => {
  await boot(page, "accountant");
  await page.goto("/pay");
  await page.getByRole("link", { name: "Accounting" }).click();
  await expect(page).toHaveURL(/\/accounting$/);
  await expect(page.getByText("19,000")).toBeVisible(); // net revenue
  await expect(page.getByText(/20,000 gross.*1,000 refunded/)).toBeVisible();
  await expect(page.getByText("17,500")).toBeVisible(); // total expenses
  await expect(page.getByText("1,500").first()).toBeVisible(); // profit
  await expect(page.getByText(/2 coach sessions aren't settled yet/)).toBeVisible();
  await expect(page.getByText("Coach payouts").first()).toBeVisible();
  await expect(page.getByText("Group training")).toBeVisible();
});

test("accounting: dept_head has no 6th tab — reaches it from Overview instead", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight");
  await expect(page.getByRole("link", { name: "Accounting" })).toHaveCount(0);
  await page.getByText("Profit & loss").click();
  await expect(page).toHaveURL(/\/accounting$/);
  await expect(page.getByText("19,000")).toBeVisible();
});

test("accounting: coaches and front desk can't reach it", async ({ page }) => {
  await boot(page, "coach");
  await page.goto("/accounting");
  await expect(page).toHaveURL("/");
});

test("accounting: expenses list, coach payouts row, and adding a one-off expense", async ({ page }) => {
  const added: Record<string, unknown>[] = [];
  await boot(page, "accountant", {
    "accounting/expenses": (b: Record<string, unknown> | null) => {
      if (b) {
        added.push(b);
        return { body: { expense: { id: "new1", categoryId: b.categoryId, categoryName: "Salaries", amount: b.amount, date: b.date, note: b.note ?? null, hasReceipt: false, receiptUrl: null, recurringId: null, createdBy: "me", editedAfterMonthEnd: false } } };
      }
      return { body: { expenses: EXPENSES } };
    },
  });
  await page.goto("/accounting");
  await page.getByRole("button", { name: "EXPENSES" }).click();
  await expect(page.getByText("October rent")).toBeVisible();
  await expect(page.getByText("Coach payouts")).toBeVisible();
  await expect(page.getByText("Settled this month · locked")).toBeVisible();

  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("AMOUNT (EGP)").fill("850");
  await page.locator("button", { hasText: "CATEGORY" }).click(); // pre-filled with the first category; open it to change
  await pickOption(page, "Salaries");
  await page.getByLabel("NOTE (OPTIONAL)").fill("Part-time cleaner");
  await page.getByRole("button", { name: "Add expense" }).click();
  await expect(page.getByText("Expense added")).toBeVisible();
  expect(added).toHaveLength(1);
  expect(added[0]).toMatchObject({ categoryId: "cat-sal", amount: 850, note: "Part-time cleaner" });
});

test("accounting: tapping coach payouts goes to the payout screen", async ({ page }) => {
  await boot(page, "accountant");
  await page.goto("/accounting");
  await page.getByRole("button", { name: "EXPENSES" }).click();
  await page.getByText("Coach payouts").first().click();
  await expect(page).toHaveURL(/\/pay$/);
});

test("accounting: recurring list shows templates, and a new one can be added", async ({ page }) => {
  const created: Record<string, unknown>[] = [];
  await boot(page, "accountant", {
    "accounting/recurring": (b: Record<string, unknown> | null) => {
      if (b) {
        created.push(b);
        return { body: { recurring: { id: "r2", categoryId: b.categoryId, categoryName: "Utilities", amount: b.amount, note: b.note ?? null, dayOfMonth: b.dayOfMonth, startMonth: THIS, endMonth: null, active: true } } };
      }
      return { body: { recurring: RECURRING } };
    },
  });
  await page.goto("/accounting");
  await page.getByRole("button", { name: "RECURRING" }).click();
  await expect(page.getByText("Rent")).toBeVisible();
  await expect(page.getByText(/Day 1/)).toBeVisible();

  await page.getByRole("button", { name: "Add a repeating expense" }).click();
  await page.getByLabel("AMOUNT (EGP)").fill("400");
  await page.locator("button", { hasText: "CATEGORY" }).click();
  await pickOption(page, "Utilities");
  await page.getByLabel("DAY OF MONTH (1–28)").fill("15");
  await page.getByRole("button", { name: "Set up repeating expense" }).click();
  await expect(page.getByText("Repeating expense set up")).toBeVisible();
  expect(created).toHaveLength(1);
  expect(created[0]).toMatchObject({ categoryId: "cat-util", amount: 400, dayOfMonth: 15 });
});

test("accounting: a new category can be added from either tab", async ({ page }) => {
  let createdName = "";
  await boot(page, "accountant", {
    "accounting/categories": (b: Record<string, unknown> | null) => {
      if (b) {
        createdName = String(b.name);
        return { body: { category: { id: "cat-new", name: b.name, sortOrder: 4, isDefault: false, archived: false } } };
      }
      return { body: { categories: CATEGORIES } };
    },
  });
  await page.goto("/accounting");
  await page.getByRole("button", { name: "EXPENSES" }).click();
  await page.getByRole("button", { name: "Categories" }).click();
  await page.getByRole("button", { name: "+ New category" }).click();
  await page.getByLabel("NEW CATEGORY").fill("Insurance");
  await page.getByRole("button", { name: "Add category" }).click();
  expect(createdName).toBe("Insurance");
});

import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// The front desk's home: every quick action opens a modal right there, new
// clients are created step by step with a summary, and the class tab is a
// calendar with day, week and month views.

const at = (dayOffset: number, hour: number) => {
  const t = new Date();
  t.setDate(t.getDate() + dayOffset);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};
const CLASSES = [
  { id: "k1", seriesId: "s1", title: "Sunrise HIIT", description: null, startsAt: at(0, 7), price: 200, status: "active", bookedCount: 3 },
  { id: "k2", seriesId: "s2", title: "Evening Yoga", description: null, startsAt: at(0, 19), price: 150, status: "active", bookedCount: 1 },
  { id: "k3", seriesId: "s1", title: "Sunrise HIIT", description: null, startsAt: at(2, 7), price: 200, status: "active", bookedCount: 0 },
  { id: "k4", seriesId: "s3", title: "Cancelled Spin", description: null, startsAt: at(0, 12), price: 100, status: "cancelled" },
];
const PLAN_TYPES = [{ id: "p2", kind: "bundle", name: "10-Class Pack", price: 1800, durationMonths: 2, credits: 10, invitationsAllowance: 0, active: true }];
const SUMMARY = { todayCheckIns: 2, todayDropIns: 1, activeNow: 1, recent: [] };

async function open(page: import("@playwright/test").Page, extra: Record<string, unknown> = {}) {
  await mockBackend(page, "front_desk", {
    "front-desk/summary": SUMMARY,
    classes: { classes: CLASSES },
    clients: { clients: [] },
    "plan-types": { planTypes: PLAN_TYPES },
    "class-series": { series: [] },
    "bundle-types": { bundleTypes: [{ id: "b1", name: "8 PT Sessions", price: 2400, sessionsIncluded: 8, expiryDays: 60 }] },
    coaches: { coaches: [{ id: "c1", name: "Coach Nour", avatarUrl: null }] },
    ...extra,
  });
  await page.goto("/");
  await expect(page.getByText("Quick actions")).toBeVisible();
}

test("home quick actions open a modal on the same page", async ({ page }) => {
  await open(page);
  const cases: [string, string | RegExp][] = [
    ["Check someone in", "Find the client by name or phone to check them in by hand."],
    ["Drop-in pass", /Drop into a class/],
    ["Guest invitation", "Guest invitations"],
    ["Classes", "MONTH"],
    ["New client", /STEP 1 OF 4/],
  ];
  for (const [action, expected] of cases) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByText(expected).first()).toBeVisible();
    // Still on Home: nothing navigated.
    expect(new URL(page.url()).pathname).toBe("/");
    await page.keyboard.press("Escape").catch(() => undefined);
    // Close by tapping the backdrop.
    await page.mouse.click(5, 5);
    await expect(page.getByText(expected).first()).toHaveCount(0);
  }
});

test("new client: step by step, then a summary to check before creating", async ({ page }) => {
  let sold: Record<string, unknown> | null = null;
  await open(page, {
    "group-plans/sell": (body: Record<string, unknown>) => {
      sold = body;
      return { body: { client: { id: "cl9" }, plan: {} } };
    },
    "client-invites": () => ({ body: { ok: true } }),
  });
  await page.getByRole("button", { name: "New client", exact: true }).click();
  await expect(page.getByText("STEP 1 OF 4")).toBeVisible();
  await expect(page.getByText("Client info", { exact: true })).toBeVisible();

  // Can't move on without the client's details.
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Name and phone number are required.")).toBeVisible();
  await page.getByLabel("FULL NAME", { exact: true }).fill("Mona K");
  await page.getByLabel("PHONE", { exact: true }).fill("0122");
  await page.getByLabel("EMAIL", { exact: true }).fill("mona@x.com");
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("STEP 2 OF 4")).toBeVisible();
  await page.getByText("Membership, class monthly or bundle").click();
  await page.getByText(/10-Class Pack/).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("STEP 3 OF 4")).toBeVisible();
  await page.getByRole("radio", { name: /Card/ }).click();
  await page.getByRole("button", { name: "Next" }).click();

  // The summary shows everything, and nothing has been created yet.
  await expect(page.getByText("STEP 4 OF 4")).toBeVisible();
  for (const line of ["Mona K", "0122", "mona@x.com", "10-Class Pack · 10 classes · 2 months", "CARD", "1,800 EGP"]) {
    await expect(page.getByText(line, { exact: false }).first()).toBeVisible();
  }
  expect(sold).toBeNull();

  // Back keeps what was entered.
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("FULL NAME", { exact: true })).toHaveValue("Mona K");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create & start plan" }).click();
  await expect(page.getByText("Client created · app invite ready")).toBeVisible();
  expect(sold).toMatchObject({ name: "Mona K", phone: "0122", email: "mona@x.com", planTypeId: "p2", payMethod: "card" });
});

test("classes: a calendar with day, week and month views", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Classes", exact: true }).click();

  // Week is the default view, showing this week's classes (not the cancelled one).
  await expect(page.getByTestId("week-day")).toHaveCount(7);
  await expect(page.getByTestId("calendar-class").filter({ hasText: "Evening Yoga" })).toHaveCount(1);
  await expect(page.getByText("Cancelled Spin")).toHaveCount(0);

  await page.getByRole("button", { name: "DAY", exact: true }).click();
  await expect(page.getByTestId("calendar-class")).toHaveCount(2);
  await expect(page.getByText("7:00 AM")).toBeVisible();
  const today = await page.getByTestId("calendar-label").innerText();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("No classes this day")).toBeVisible();
  await page.getByRole("button", { name: "TODAY", exact: true }).click();
  await expect(page.getByTestId("calendar-label")).toHaveText(today);

  await page.getByRole("button", { name: "MONTH" }).click();
  await expect(page.getByTestId("calendar-label")).toContainText(String(new Date().getFullYear()));
  await expect(page.getByRole("button", { name: /, 2 classes$/ })).toHaveCount(1);
  // Picking a day lists its classes underneath.
  await page.getByRole("button", { name: /, 2 classes$/ }).click();
  await expect(page.getByTestId("calendar-class")).toHaveCount(2);
});

test("classes: on a phone the week is a list by day", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.getByRole("button", { name: "Classes", exact: true }).click();
  await expect(page.getByTestId("week-day")).toHaveCount(7);
  await expect(page.getByTestId("calendar-class").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// A shared bundle (Solid's Shared 100: 2 clients x 50 classes, 4 months each) is
// sold to two clients at once from the first client's sheet.

const person = (id: string, name: string, phone: string) => ({
  id, name, age: null, phone, email: null, conditions: null, assignedCoachId: null,
  currentPackage: null, currentMembership: null, groupPlan: null, lastGroupPlan: null });
const PLAN_TYPES = [
  { id: "pt-100", kind: "bundle", name: "100 Sessions", price: 11000, durationMonths: 6, credits: 100, invitationsAllowance: 0, active: true },
  { id: "pt-sh", kind: "bundle", name: "Shared 100 (2 × 50)", price: 11000, durationMonths: 4, credits: 100, invitationsAllowance: 0, active: true, sharedSeats: 2 },
];

async function boot(page: Page, sold: { body: unknown }[]) {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "front_desk", {
    "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] },
    clients: { clients: [person("e1", "Nour Hassan", "0100111001"), person("e2", "Salma Reda", "0100111002")] },
    "plan-types": { planTypes: PLAN_TYPES },
    "class-series": { series: [] }, classes: { classes: [] }, "bundle-types": { bundleTypes: [] }, coaches: { coaches: [] },
    "group-plans/sell": (body: unknown) => {
      sold.push({ body });
      return { body: { client: person("e1", "Nour Hassan", "0100111001"), plan: {} } };
    },
  });
}

async function openSell(page: Page) {
  await page.goto("/members");
  await page.getByText("Nour Hassan").first().click();
  await page.getByRole("button", { name: "Sell a plan" }).click();
  await page.locator("button", { hasText: "GROUP PLAN" }).click();
  await page.getByRole("button", { name: /Shared 100/ }).click();
}

test("shared bundle: needs the other client, shows the split, and sells both in one call", async ({ page }) => {
  const sold: { body: unknown }[] = [];
  await boot(page, sold);
  await openSell(page);

  await expect(page.getByText(/Shared by 2: 50 classes and 5,?500 EGP each, 4 months/)).toBeVisible();
  // The wallet isn't offered for a shared sale.
  await expect(page.getByRole("button", { name: "WALLET" })).toHaveCount(0);

  // Can't start without the other client.
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect(page.getByText("Choose who Nour Hassan shares this with.")).toBeVisible();
  expect(sold).toHaveLength(0);

  await page.getByPlaceholder("Search the other client").fill("Salma");
  await page.getByRole("button", { name: /^Salma Reda ·/ }).click();
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect.poll(() => sold.length).toBe(1);
  expect(sold[0].body).toMatchObject({ clientId: "e1", planTypeId: "pt-sh", payMethod: "cash", partners: [{ clientId: "e2" }] });
});

test("shared bundle: a normal plan has no partner step", async ({ page }) => {
  const sold: { body: unknown }[] = [];
  await boot(page, sold);
  await page.goto("/members");
  await page.getByText("Nour Hassan").first().click();
  await page.getByRole("button", { name: "Sell a plan" }).click();
  await page.locator("button", { hasText: "GROUP PLAN" }).click();
  await page.getByRole("button", { name: /^100 Sessions/ }).click();
  await expect(page.getByPlaceholder("Search the other client")).toHaveCount(0);
  await page.getByRole("button", { name: "Start plan" }).click();
  await expect.poll(() => sold.length).toBe(1);
  expect((sold[0].body as Record<string, unknown>).partners).toBeUndefined();
});

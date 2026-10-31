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

test("shared bundle: the new-client form sells it too, with a brand-new second client who also gets an invite", async ({ page }) => {
  const sold: { body: unknown }[] = [];
  const invited: unknown[] = [];
  await boot(page, sold);
  await page.route("**/client-invites", (r) => { invited.push(JSON.parse(r.request().postData() ?? "{}")); return r.fulfill({ json: { ok: true } }); });
  await page.route("**/group-plans/sell", (r) => {
    sold.push({ body: JSON.parse(r.request().postData() ?? "{}") });
    return r.fulfill({ json: { client: person("n1", "Omar Ali", "0100999001"), plan: {}, sharedWith: [{ id: "n2", name: "Dina Ali" }] } });
  });
  await page.goto("/members");
  await page.getByRole("button", { name: "+ New client" }).first().click();
  await page.getByLabel("FULL NAME").fill("Omar Ali");
  await page.getByLabel("PHONE", { exact: true }).fill("0100999001");
  await page.getByLabel("EMAIL").fill("omar@example.com");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: /^GROUP PLAN\s*\S/ }).filter({ hasNotText: /^GROUP PLAN$/ }).click();
  await page.getByRole("button", { name: /Shared 100/ }).click();
  await expect(page.getByText(/Shared by 2: 50 classes/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Choose who this client shares the plan with.")).toBeVisible();

  await page.getByRole("button", { name: "Add as a new client" }).click();
  await page.getByLabel("FULL NAME").last().fill("Dina Ali");
  await page.getByLabel("PHONE", { exact: true }).last().fill("0100999002");
  await page.getByLabel("EMAIL").last().fill("dina@example.com");
  await page.getByRole("button", { name: "Add client" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Dina Ali")).toBeVisible();
  await page.getByRole("button", { name: "Create & start plan" }).click();
  await expect.poll(() => sold.length).toBe(1);
  expect(sold[0].body).toMatchObject({ name: "Omar Ali", planTypeId: "pt-sh", partners: [{ name: "Dina Ali", phone: "0100999002", email: "dina@example.com" }] });
  await expect.poll(() => invited.length).toBe(2); // Omar's and Dina's
  expect(invited).toEqual(expect.arrayContaining([expect.objectContaining({ clientId: "n2", email: "dina@example.com" })]));
});

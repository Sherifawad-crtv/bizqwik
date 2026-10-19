import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// The desk's two jobs — letting people in and taking money — at a glance:
// an honest status per member, check-in straight from the search results,
// a priced charge button, selling next to checking in, and tomorrow's classes
// once today's are over.

const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const at = (dd: number, h: number) => { const d = new Date(); d.setDate(d.getDate() + dd); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const plan = (cid: string, kind: string, name: string, end: number, credits?: [number, number], frozen?: number) => ({
  id: "gp" + cid, clientId: cid, kind, planTypeId: "p1", seriesId: null, name, priceAtSale: 800, payMethod: "cash",
  creditsTotal: credits ? credits[1] : null, creditsRemaining: credits ? credits[0] : null, invitationsRemaining: 0,
  startsAt: days(-20), expiresAt: days(end), status: "active", frozenUntil: frozen ? days(frozen) : null });
const pkg = (cid: string, rem: number, inc: number) => ({ id: "pk" + cid, clientId: cid, bundleTypeId: "b1", coachId: "c1", purchaseDate: days(-10), expiryDate: days(30), sessionsIncluded: inc, sessionsRemaining: rem, priceAtSale: 2400, coachCutAtSale: 960, status: "active", createdBy: "x" });
const c = (id: string, name: string, gp: unknown, p: unknown = null) => ({ id, name, age: 30, phone: "0100555" + id, email: null, conditions: null, assignedCoachId: "c1", currentPackage: p, currentMembership: null, groupPlan: gp });
const CLIENTS = [
  c("a1", "Ahmed Samy", plan("a1", "membership", "3-Month Gym Access", 50)),
  c("a2", "Hana Mostafa", plan("a2", "bundle", "10 Class Pass", 30, [2, 10])),
  c("a3", "Omar Fathy", plan("a3", "membership", "Annual Gym Access", 160, undefined, 6)),
  c("a4", "Yara Essam", null, pkg("a4", 12, 12)),
  c("a5", "Mahmoud Ali", null),
  c("a6", "Laila Hassan", plan("a6", "membership", "Monthly Gym Access", 1)),
];

async function boot(page: Page, extra: Record<string, unknown> = {}, classes: unknown[] = []) {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "front_desk", {
    "front-desk/summary": { todayCheckIns: 3, todayDropIns: 0, activeNow: 1, recent: [] },
    clients: { clients: CLIENTS },
    classes: { classes },
    "bundle-types": { bundleTypes: [{ id: "b1", name: "8 PT Sessions", price: 2400, sessionsIncluded: 8, expiryDays: 60 }] },
    "plan-types": { planTypes: [] },
    "class-series": { series: [] },
    coaches: { coaches: [{ id: "c1", name: "Karim Adel", avatarUrl: null }] },
    ...extra,
  });
}
const pillFor = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) }).getByTestId("status-pill").first();

test("desk: the status says what matters — frozen, nearly out, ending, PT only, no plan", async ({ page }) => {
  await boot(page);
  await page.goto("/members");
  const row = (name: string) => page.locator("button", { hasText: name }).getByTestId("status-pill");
  await expect(row("Ahmed Samy")).toHaveText("ACTIVE");
  await expect(row("Hana Mostafa")).toHaveText("2 LEFT");
  await expect(row("Omar Fathy")).toHaveText("FROZEN");
  await expect(row("Yara Essam")).toHaveText("PT ONLY · 12 LEFT");
  await expect(row("Mahmoud Ali")).toHaveText("NO PLAN");
  await expect(row("Laila Hassan")).toHaveText("ENDS TOMORROW");
  await expect(row("Omar Fathy")).toHaveAttribute("data-tone", "frozen");
});

test("desk: check in straight from the home search — one tap, no sheet", async ({ page }) => {
  const sent: unknown[] = [];
  await boot(page, {
    "check-ins": (b) => {
      sent.push(b);
      return { body: { checkIn: { id: "ci1" }, deducted: true, plan: { name: "10 Class Pass", kind: "bundle", creditsRemaining: 1, creditsTotal: 10 } } };
    },
  });
  await page.goto("/");
  await page.getByLabel("Find a client by name or phone").fill("Hana");
  const result = page.getByTestId("home-result").filter({ hasText: "Hana Mostafa" });
  await result.getByRole("button", { name: "Check in" }).click();
  await expect(result.getByText("Done")).toBeVisible();
  await expect(result.getByText("Checked in · 1 of 10 left")).toBeVisible();
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ clientId: "a2", source: "manual" });

  // A frozen member gets "Options" (the sheet explains why), not a check-in button.
  await page.getByLabel("Find a client by name or phone").fill("Omar");
  const omar = page.getByTestId("home-result").filter({ hasText: "Omar Fathy" });
  await expect(omar.getByRole("button", { name: "Check in" })).toHaveCount(0);
  await omar.getByRole("button", { name: "Options" }).click();
  await expect(page.getByText(/Their plan is frozen until/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm check-in" })).toHaveCount(0);
});

test("desk: a drop-in shows what it will charge, on the next class by default", async ({ page }) => {
  await boot(page, {}, [
    { id: "k1", seriesId: "s1", title: "Evening Yoga", description: null, startsAt: at(0, 23), price: 150, status: "active", bookedCount: 3 },
    { id: "k2", seriesId: "s2", title: "Saturday Spin", description: null, startsAt: at(2, 10), price: 200, status: "active", bookedCount: 0 },
  ]);
  await page.goto("/");
  await page.getByRole("button", { name: "Drop-in pass" }).click();
  await expect(page.getByRole("button", { name: "Charge 150 EGP · cash" })).toBeVisible();
  await page.getByRole("button", { name: "CARD", exact: true }).click();
  await expect(page.getByRole("button", { name: "Charge 150 EGP · card" })).toBeVisible();
});

test("desk: selling sits next to checking in on a member's card", async ({ page }) => {
  await boot(page);
  await page.goto("/members");
  await page.getByText("Yara Essam").click();
  await expect(page.getByRole("button", { name: "Check in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sell plan" })).toBeVisible();
});

test("desk: once today's classes are over, home and Bookings show the next day", async ({ page }) => {
  await boot(page, {}, [{ id: "k9", seriesId: "s1", title: "Saturday Spin", description: null, startsAt: at(1, 10), price: 150, status: "active", bookedCount: 5 }]);
  await page.goto("/");
  await expect(page.getByTestId("next-day-label")).toHaveText("Nothing left today · Tomorrow");
  await expect(page.getByText("Saturday Spin")).toBeVisible();
  await page.goto("/bookings");
  await expect(page.getByTestId("next-day")).toContainText("Nothing left today");
  await expect(page.getByTestId("next-day").getByText("Saturday Spin")).toBeVisible();
});

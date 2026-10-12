import { test, expect } from "@playwright/test";
import { mockBackend, BUNDLE_PLAN, PRICE_OFFERS } from "./mocks";
const OUT = "/tmp/claude-0/-home-user-bizqwik/ab89842c-75ea-5135-934f-23e46fe89c2a/scratchpad/shots";
const NINE = new Date(new Date().setHours(9, 0, 0, 0));
const at = (h: number, m = 0) => new Date(new Date(NINE).setHours(h, m)).toISOString();
const cls = (id: string, title: string, startsAt: string, extra: Record<string, unknown> = {}) => ({ id, seriesId: "s-" + id, title, description: null, startsAt, price: 150, status: "active", booked: false, coverage: "drop_in", imageUrl: null, going: { count: 0, initials: [] }, ...extra });
const CLASSES = [
  cls("a", "Sunrise HIIT", at(18), { going: { count: 38, initials: ["AK", "MS", "LH", "NR"] }, coverage: "plan" }),
  cls("b", "Power Yoga", at(18), { booked: true, going: { count: 9, initials: ["You", "HB", "OT", "SA"] } }),
  cls("c", "Boxing", at(20, 30)),
];
test("shots", async ({ page }) => {
  await page.clock.install({ time: NINE });
  await mockBackend(page, { classes: [], home: { groupPlan: BUNDLE_PLAN, package: null } });
  await page.route(/\/client\/branding/, (r) => r.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify({ org: { id: "org-revolt", name: "Your Gym", slug: "revolt", status: "trial", mode: "team" }, branding: { appName: "Your Gym", logoUrl: null, iconUrl: null, primaryColor: "#5A41FF", onboardingAssets: [] }, locations: [] }) }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?gym=revolt");
  await page.getByRole("button", { name: "Skip" }).click();
  await page.locator('input[type="email"]').fill("zara@zztest.dev");
  await page.locator('input[type="password"]').fill("ZZpass123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: /Hi, Zara/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "/home.png" });
  const shot = async (f: string) => { await page.waitForTimeout(1200); await page.screenshot({ path: OUT + "/" + f + ".png" }); };
  const home = async () => { await page.goto("/?gym=revolt"); await page.waitForTimeout(1500); };
  await page.getByText("Points", { exact: true }).first().click(); await shot("points");
  await home();
  await page.getByRole("button", { name: "Details" }).first().click(); await shot("plan");
  await home();
  await page.locator("nav button, nav a").nth(3).click(); await shot("profile");
});

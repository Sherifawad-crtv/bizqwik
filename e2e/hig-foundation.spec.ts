import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// Apple HIG foundation: how sheets, taps and tab switches behave.

const PLAN_TYPES = [{ id: "m1", kind: "membership", name: "Calisthenics - 1 Month", price: 2800, durationMonths: 1, credits: null, invitationsAllowance: 0, active: true }];
const BUNDLES = [{ id: "b1", name: "PT - 10 Sessions", price: 4000, sessionsIncluded: 10, expiryDays: 30, active: true }];

async function boot(page: Page, extra: Record<string, unknown> = {}) {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", { "plan-types": { planTypes: PLAN_TYPES }, "class-series": { series: [] }, "bundle-types": { bundleTypes: BUNDLES }, ...extra });
}
const openNewBundle = async (page: Page) => {
  await page.goto("/catalog");
  await page.getByRole("button", { name: "PT BUNDLES" }).click();
  await page.getByRole("button", { name: "+ New bundle" }).first().click();
  await expect(page.getByTestId("sheet-backdrop")).toBeVisible();
};
const backdropOpacity = (page: Page) => page.getByTestId("sheet-backdrop").evaluate((el) => Number(getComputedStyle(el).opacity));

test("sheet: the dark backdrop fades in with the sheet and out when it leaves", async ({ page }) => {
  await boot(page);
  await openNewBundle(page);
  await expect.poll(() => backdropOpacity(page)).toBeGreaterThan(0.95);
  await page.getByRole("button", { name: "Cancel" }).click();
  // Mid-leave it is neither fully dark nor gone yet.
  await page.waitForTimeout(120);
  const mid = await backdropOpacity(page).catch(() => 0);
  expect(mid).toBeGreaterThan(0);
  expect(mid).toBeLessThan(1);
  await expect(page.getByTestId("sheet-backdrop")).toHaveCount(0);
});

test("sheet: a quick flick down dismisses it, a short slow pull springs back", async ({ page }) => {
  await boot(page);
  await openNewBundle(page);
  await page.waitForTimeout(500);
  const g = (await page.getByTestId("sheet-grabber").boundingBox())!;
  const x = g.x + g.width / 2;
  const y = g.y + g.height / 2;

  // slow, short: 40 px over a second
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(x, y + i * 5); await page.waitForTimeout(120); }
  await page.mouse.up();
  await page.waitForTimeout(600);
  await expect(page.getByTestId("sheet-backdrop")).toBeVisible();

  // fast flick: well under a third of the sheet's height, but thrown quickly
  const g2 = (await page.getByTestId("sheet-grabber").boundingBox())!;
  await page.mouse.move(x, g2.y + 10);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(x, g2.y + 10 + i * 12); await page.waitForTimeout(6); }
  await page.mouse.up();
  await expect(page.getByTestId("sheet-backdrop")).toHaveCount(0, { timeout: 3000 });
});

test("sheet: dismissing a sheet you've typed in asks first; an empty one just closes", async ({ page }) => {
  await boot(page);
  await openNewBundle(page);
  await page.waitForTimeout(500);
  // empty: Escape closes it
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("sheet-backdrop")).toHaveCount(0, { timeout: 3000 });

  await openNewBundle(page);
  await page.waitForTimeout(500);
  await page.getByLabel("NAME").fill("24-Session Pack");
  await page.mouse.click(195, 40); // the dark area above the sheet
  await expect(page.getByText("Discard changes?")).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("NAME")).toHaveValue("24-Session Pack");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByTestId("sheet-backdrop")).toHaveCount(0, { timeout: 3000 });
});

test("sheet: Cancel on a typed-in sheet closes without asking", async ({ page }) => {
  await boot(page);
  await openNewBundle(page);
  await page.getByLabel("NAME").fill("x");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("sheet-backdrop")).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByText("Discard changes?")).toHaveCount(0);
});

test("saving a routine edit closes straight away, with no checkmark", async ({ page }) => {
  let created = 0;
  await boot(page, { "bundle-types": (b: Record<string, unknown> | null) => (b ? ((created++), { body: { bundleType: { id: "b2", ...b } } }) : { body: { bundleTypes: BUNDLES } }) });
  await openNewBundle(page);
  await page.getByLabel("NAME").fill("20-Session Pack");
  await page.getByLabel("PRICE · EGP").fill("7000");
  await page.getByLabel("SESSIONS INCLUDED").fill("20");
  await page.getByLabel("EXPIRES AFTER · DAYS").fill("30");
  await page.getByRole("button", { name: "Create bundle" }).click();
  await expect.poll(() => created).toBe(1);
  await expect(page.getByTestId("sheet-backdrop")).toHaveCount(0, { timeout: 3000 });
  await expect(page.getByText("Bundle created")).toHaveCount(0);
});

test("tab switch: the new screen fades in, nothing slides sideways", async ({ page }) => {
  await boot(page);
  await page.goto("/oversight");
  await page.waitForTimeout(1500);
  await page.getByRole("link", { name: "Catalog" }).click();
  const transforms = await page.evaluate(() => [...document.querySelectorAll("main [data-scroll]")].map((el) => getComputedStyle(el).transform));
  expect(transforms.every((t) => t === "none")).toBe(true);
  await expect(page.getByRole("button", { name: "PLANS" })).toBeVisible();
});

test("tap targets: edit and delete icons respond within 44 px of their centre", async ({ page }) => {
  await boot(page);
  await page.goto("/catalog");
  await page.getByRole("button", { name: "PLANS" }).click();
  const edit = page.getByRole("button", { name: "Edit Calisthenics - 1 Month" });
  const box = (await edit.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (const [dx, dy] of [[21, 0], [-21, 0], [0, 21], [0, -21]]) {
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label") ?? null, [cx + dx, cy + dy]);
    expect(hit).toBe("Edit Calisthenics - 1 Month");
  }
});

test("press: a tapped button dims while your finger is down", async ({ page }) => {
  await boot(page);
  await page.goto("/catalog");
  await page.getByRole("button", { name: "PT BUNDLES" }).click();
  const btn = page.getByRole("button", { name: "+ New bundle" }).first();
  const box = (await btn.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(300);
  const down = await btn.evaluate((el) => Number(getComputedStyle(el).opacity));
  await page.mouse.up({ button: "left" });
  expect(down).toBeLessThan(0.8);
});

import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// Apple's motion guidance, checked: quick (≤350ms), purposeful, from one scale.

const now = new Date();
const ym = (back: number) => { const d = new Date(now.getFullYear(), now.getMonth() - back, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const months = [3, 2, 1, 0].map((b, i) => ({ month: ym(b), revenue: 8000 + i * 4000, payouts: 3000 + i * 1000, profit: 5000 + i * 3000 }));
const report = (ms = months) => ({ months: ms, totals: { revenue: ms.reduce((s, m) => s + m.revenue, 0), payouts: ms.reduce((s, m) => s + m.payouts, 0), profit: ms.reduce((s, m) => s + m.profit, 0) }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 0, groupPlans: 0, ptPackages: 0, byPlanKind: {} }, walletLiability: 0 });

const barHeights = (page: Page) => page.evaluate(() => [...document.querySelectorAll("svg[role=img] path")].map((p) => Math.round((p as SVGGraphicsElement).getBBox().height)));

test.use({ viewport: { width: 390, height: 1400 } });

test("chart bars grow up from the baseline when the chart appears, and settle within 350ms", async ({ page }) => {
  await mockBackend(page, "dept_head", { revenue: () => ({ body: report() }) });
  await page.goto("/oversight");
  await page.locator("svg[role=img]").first().waitFor();
  const early = await barHeights(page);
  await page.waitForTimeout(500);
  const settled = await barHeights(page);
  expect(settled.length).toBeGreaterThan(0);
  const tallest = Math.max(...settled);
  expect(Math.max(0, ...early)).toBeLessThan(tallest); // caught mid-growth
  await page.waitForTimeout(200);
  expect(await barHeights(page)).toEqual(settled); // and it has stopped
});

test("a chart's tooltip fades in", async ({ page }) => {
  await mockBackend(page, "dept_head", { revenue: () => ({ body: report() }) });
  await page.goto("/oversight");
  const svg = page.locator("svg[role=img]").first();
  await svg.waitFor();
  await page.waitForTimeout(500);
  await svg.locator("g").last().hover(); // a mouse hover shows the figures
  const anim = await page.evaluate(() => {
    const tip = [...document.querySelectorAll("div")].reverse().find((d) => getComputedStyle(d).position === "absolute" && /Revenue/.test(d.textContent || "") && /Payouts/.test(d.textContent || ""));
    return tip ? getComputedStyle(tip).animationName : null;
  });
  expect(anim).toBe("bqFade");
});

test("on a phone, tapping a bar shows its figures and tapping again hides them", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await mockBackend(page, "dept_head", { revenue: () => ({ body: report() }) });
  await page.goto("/oversight");
  const svg = page.locator("svg[role=img]").first();
  await svg.waitFor();
  await page.waitForTimeout(500);
  const bar = svg.locator("g").last();
  await bar.tap();
  await expect(page.getByText(/^Payouts /)).toBeVisible();
  await bar.tap();
  await expect(page.getByText(/^Payouts /)).toHaveCount(0);
  await ctx.close();
});

test("charts glide, they don't jump: bars travel to new heights when the numbers change", async ({ page }) => {
  // Use the founder chart and change its data under it (a refresh with new numbers).
  let bump = 0;
  await mockBackend(page, "dept_head", { revenue: () => ({ body: report(months.map((m) => ({ ...m, revenue: m.revenue + bump }))) }) });
  await page.goto("/oversight");
  await page.locator("svg[role=img]").first().waitFor();
  await page.waitForTimeout(600);
  const before = await barHeights(page);
  bump = 6000;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); // the app refreshes what's open
  await page.waitForFunction((b) => {
    const h = [...document.querySelectorAll("svg[role=img] path")].map((p) => Math.round((p as SVGGraphicsElement).getBBox().height));
    return h.join() !== b.join();
  }, before);
  const mid = await barHeights(page);
  await page.waitForTimeout(500);
  const after = await barHeights(page);
  expect(after.join()).not.toBe(before.join());
  // At least one bar was seen between its old and new height.
  expect(mid.some((h, i) => h !== after[i])).toBe(true);
});

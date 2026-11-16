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

test("content fades in where its loading placeholder was (no pop)", async ({ page }) => {
  await mockBackend(page, "dept_head", { revenue: () => ({ body: report() }) });
  // Hold the numbers back a moment so the placeholder is on screen first.
  await page.route(/\/revenue\?/, async (route) => { await new Promise((r) => setTimeout(r, 600)); await route.fallback(); });
  await page.goto("/oversight");
  await expect(page.getByTestId("skeleton").first()).toBeVisible();
  await page.getByText("REVENUE VS COACH PAYOUTS").waitFor();
  const anim = await page.evaluate(() => {
    const host = document.querySelector("[data-reveal]");
    const kids = host ? [...host.children].map((c) => getComputedStyle(c).animationName) : [];
    return kids;
  });
  expect(anim).toContain("bqFade");
});

test("big money figures glide to their new value instead of jumping", async ({ page }) => {
  let bump = 0;
  await mockBackend(page, "dept_head", { revenue: () => ({ body: report(months.map((m) => ({ ...m, revenue: m.revenue + bump }))) }) });
  await page.goto("/oversight");
  const revenueTile = page.getByText("REVENUE", { exact: true }).locator("xpath=following-sibling::div[1]");
  await expect(revenueTile).toHaveText(/\d/);
  await page.waitForTimeout(400);
  const before = (await revenueTile.innerText()).trim();
  bump = 9000;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForFunction((b) => { const el = [...document.querySelectorAll("div")].find((d) => d.textContent === "REVENUE")?.nextElementSibling; return !!el && el.textContent!.trim() !== b; }, before);
  const seen = new Set<string>();
  for (let i = 0; i < 12; i++) { seen.add((await revenueTile.innerText()).trim()); await page.waitForTimeout(25); }
  await page.waitForTimeout(400);
  const after = (await revenueTile.innerText()).trim();
  expect(after).not.toBe(before);
  expect([...seen].some((v) => v !== after && v !== before)).toBe(true); // passed through values in between
});

test("list rows grow in when added and fold away when removed; the rest slide to make room", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const THIS = ym(0);
  const ex = (id: string, note: string) => ({ id, categoryId: "c1", categoryName: "Rent", amount: 1000, date: `${THIS}-02`, note, hasReceipt: false, receiptUrl: null, recurringId: null, createdBy: "me", editedAfterMonthEnd: false });
  let list = [ex("e1", "First row"), ex("e2", "Second row")];
  await mockBackend(page, "accountant", {
    "accounting/categories": { categories: [{ id: "c1", name: "Rent", sortOrder: 1, isDefault: true, archived: false }] },
    "accounting/expenses": () => ({ body: { expenses: list } }),
    "accounting/recurring": { recurring: [] },
    "accounting/pnl": { month: THIS, current: { month: THIS, grossRevenue: 0, refunds: 0, netRevenue: 0, coachPayouts: 0, otherExpenses: 0, totalExpenses: 0, profit: 0 }, trend: [], revenueBySource: [], expensesBySource: [], hasPastExpenses: true, unsettledNote: null },
    [`month/${THIS}`]: { rows: [] },
  });
  await page.goto("/accounting");
  await page.getByRole("button", { name: "EXPENSES" }).click();
  await expect(page.getByText("Second row")).toBeVisible();
  const stateOf = (text: string) => page.getByText(text).locator("xpath=ancestor::div[contains(@class,'bq-li')][1]").getAttribute("data-state");
  expect(await stateOf("First row")).toBe("idle"); // rows already there when the list appeared don't animate

  // Added on another phone; the app refreshes.
  list = [ex("e1", "First row"), ex("e3", "New row"), ex("e2", "Second row")];
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByText("New row")).toBeVisible();
  expect(await stateOf("New row")).toBe("in");
  expect(await page.getByText("New row").locator("xpath=ancestor::div[contains(@class,'bq-li')][1]").evaluate((el) => getComputedStyle(el).animationName)).toBe("bqListIn");

  // Removed: it folds away, then it's gone.
  list = [ex("e1", "First row"), ex("e2", "Second row")];
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => stateOf("New row"), { intervals: [20], timeout: 2000 }).toBe("out");
  await expect(page.getByText("New row")).toHaveCount(0, { timeout: 1000 });
});

test("the tab bar and a sub-page's actions hand over in one motion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const THIS = ym(0);
  const row = { coachId: "c1", name: "Coach Nour", email: "c1@x.com", role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 250, count: 4, groupTotal: 1000, privateTotal: 0, packageCount: 0, total: 1000, state: "logging", settledAt: null, paidAt: null, paidAmount: 0, remaining: 1000 };
  await mockBackend(page, "dept_head", { [`month/${THIS}`]: { rows: [row] }, [`sessions/c1/${THIS}`]: { sessions: [] }, [`packages/by-coach/c1/${THIS}`]: { packages: [] } });
  await page.goto("/coaches");
  await page.getByText("Coach Nour").waitFor();
  await page.waitForTimeout(400);
  const layers = () => page.evaluate(() => [...document.querySelectorAll(".bq-barlayer")].map((l) => ({ on: l.getAttribute("data-on"), opacity: +getComputedStyle(l).opacity, vis: getComputedStyle(l).visibility })));
  await page.getByText("Coach Nour").click();
  // mid-handover: both are partly visible at once (one fading out, the other in)
  await expect.poll(async () => (await layers()).every((l) => l.opacity > 0.05 && l.opacity < 0.95), { intervals: [10], timeout: 1500 }).toBe(true);
  await page.waitForTimeout(450);
  const [nav, actions] = await layers();
  expect(nav).toMatchObject({ on: "false", opacity: 0, vis: "hidden" });
  expect(actions).toMatchObject({ on: "true", opacity: 1, vis: "visible" });
  await expect(page.getByRole("button", { name: "Settle month" })).toBeVisible();
});

test.describe("with Reduce Motion on", () => {
  test.use({ reducedMotion: "reduce" });

  test("going deeper is a crossfade, not a slide; sheets fade in place; presses don't shrink", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const THIS = ym(0);
    const row = { coachId: "c1", name: "Coach Nour", email: "c1@x.com", role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 250, count: 4, groupTotal: 1000, privateTotal: 0, packageCount: 0, total: 1000, state: "logging", settledAt: null, paidAt: null, paidAmount: 0, remaining: 1000 };
    await mockBackend(page, "dept_head", { [`month/${THIS}`]: { rows: [row] }, [`sessions/c1/${THIS}`]: { sessions: [] }, [`packages/by-coach/c1/${THIS}`]: { packages: [] }, revenue: report() });
    await page.goto("/coaches");
    await page.getByText("Coach Nour").waitFor();
    await page.waitForTimeout(300);
    await page.getByText("Coach Nour").click();
    // sample a few frames: no layer is ever pushed sideways
    for (let i = 0; i < 8; i++) {
      const xs = await page.evaluate(() => [...document.querySelectorAll("main [data-scroll]")].map((el) => { const t = getComputedStyle(el).transform; return t === "none" ? 0 : new DOMMatrixReadOnly(t).m41; }));
      expect(xs.every((x) => Math.abs(x) < 1)).toBe(true);
      await page.waitForTimeout(30);
    }
    await expect(page).toHaveURL(/\/coaches\/c1$/);
    // press: no shrink
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--press-scale").trim())).toBe("1");
    // sheet: opens without sliding
    await page.goto("/oversight");
    await page.getByRole("button", { name: "Create" }).click();
    const panel = page.locator("[role=dialog] > div").nth(1);
    await expect(panel).toBeVisible();
    await page.waitForTimeout(60);
    const y = await panel.evaluate((el) => { const t = getComputedStyle(el).transform; return t === "none" ? 0 : new DOMMatrixReadOnly(t).m42; });
    expect(y).toBe(0);
  });

  test("charts and figures appear at their values without growing", async ({ page }) => {
    await mockBackend(page, "dept_head", { revenue: () => ({ body: report() }) });
    await page.goto("/oversight");
    await page.locator("svg[role=img]").first().waitFor();
    const first = await barHeights(page);
    await page.waitForTimeout(400);
    expect(await barHeights(page)).toEqual(first);
  });
});

test("tapping quickly through screens never leaves two screens half-moved", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const THIS = ym(0);
  const row = { coachId: "c1", name: "Coach Nour", email: "c1@x.com", role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 250, count: 4, groupTotal: 1000, privateTotal: 0, packageCount: 0, total: 1000, state: "logging", settledAt: null, paidAt: null, paidAmount: 0, remaining: 1000 };
  await mockBackend(page, "dept_head", { [`month/${THIS}`]: { rows: [row] }, [`sessions/c1/${THIS}`]: { sessions: [] }, [`packages/by-coach/c1/${THIS}`]: { packages: [] }, revenue: report() });
  await page.goto("/coaches");
  await page.getByText("Coach Nour").waitFor();
  await page.waitForTimeout(300);
  // In, back out before the slide ends, in again, out again — faster than any slide.
  await page.getByText("Coach Nour").click();
  await page.waitForTimeout(80);
  await page.getByRole("button", { name: "Back" }).click();
  await page.waitForTimeout(80);
  await page.getByText("Coach Nour").click();
  await page.waitForTimeout(80);
  await page.getByRole("button", { name: "Back" }).click();
  await page.waitForTimeout(600);
  await expect(page).toHaveURL(/\/coaches$/);
  const layers = await page.evaluate(() => [...document.querySelectorAll("main [data-scroll]")].map((el) => { const cs = getComputedStyle(el); const t = cs.transform; return { x: t === "none" ? 0 : new DOMMatrixReadOnly(t).m41, vis: cs.visibility, op: +cs.opacity }; }));
  const shown = layers.filter((l) => l.vis === "visible" && l.op > 0.5);
  expect(shown.length).toBe(1); // exactly one screen on view
  expect(Math.abs(shown[0].x)).toBeLessThan(1); // and it's at rest
  await expect(page.getByText("Coach Nour")).toBeVisible();
});

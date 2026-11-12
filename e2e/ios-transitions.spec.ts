import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// How screens move, the iOS way: tabs are peers (a fade), going deeper slides in,
// going back slides away, and tapping a tab while deep is a fade, not a "back".

const now = new Date();
const THIS = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const row = (id: string, name: string) => ({ coachId: id, name, email: `${id}@x.com`, role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 250, count: 4, groupTotal: 1000, privateTotal: 0, packageCount: 0, total: 1000, state: "settled", settledAt: "2026-10-30T10:00:00Z", paidAt: null, paidAmount: 0, remaining: 1000 });
const REVENUE = { months: [], totals: { revenue: 0, payouts: 0, profit: 0 }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 0, groupPlans: 0, ptPackages: 0, byPlanKind: {} }, walletLiability: 0 };
const PNL = { month: THIS, current: { month: THIS, grossRevenue: 0, refunds: 0, netRevenue: 0, coachPayouts: 0, otherExpenses: 0, totalExpenses: 0, profit: 0 }, trend: [], revenueBySource: [], expensesBySource: [], hasPastExpenses: false, unsettledNote: null };

async function boot(page: Page, role: "dept_head" | "accountant") {
  await page.setViewportSize({ width: 390, height: 844 });
  // Every earlier month of the year answers too (empty), as the real backend does.
  const earlier: Record<string, unknown> = {};
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    if (d.getFullYear() === now.getFullYear()) earlier[`month/${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { rows: [] };
  }
  await mockBackend(page, role, {
    ...earlier,
    revenue: REVENUE,
    [`month/${THIS}`]: { rows: [row("c1", "Coach Nour")] },
    [`sessions/c1/${THIS}`]: { sessions: [] }, [`packages/by-coach/c1/${THIS}`]: { packages: [] },
    "accounting/pnl": PNL, "accounting/categories": { categories: [] }, "accounting/expenses": { expenses: [] }, "accounting/recurring": { recurring: [] },
    "pay/payments": { payments: [] },
  });
}
// The sideways offsets of every screen layer, a moment after the tap.
const offsets = async (page: Page) => {
  // Sample for a moment: a slow machine may start the move a little late. Returns the
  // first sample that is mid-slide, or the last one if nothing ever slid.
  let xs: number[] = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(i === 0 ? 70 : 30);
    xs = await page.evaluate(() => [...document.querySelectorAll("main [data-scroll]")].map((el) => {
      const t = getComputedStyle(el).transform;
      return t === "none" ? 0 : new DOMMatrixReadOnly(t).m41;
    }));
    if (slides(xs)) return xs;
  }
  return xs;
};
const slides = (xs: number[]) => xs.some((x) => x > 20) || xs.some((x) => x < -20);
const settle = (page: Page) => page.waitForTimeout(500);

test("tabs are peers: switching between them fades, nothing slides", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.getByRole("link", { name: "Team" }).click();
  expect(slides(await offsets(page))).toBe(false);
  await settle(page);
  await page.getByRole("link", { name: "Catalog" }).click();
  expect(slides(await offsets(page))).toBe(false);
});

test("going deeper slides in; going back slides away", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/coaches"); await page.waitForTimeout(1200);
  await page.getByText("Coach Nour").click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/coaches\/c1$/);
  await settle(page);
  await page.getByRole("button", { name: /Team/ }).first().click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/coaches$/);
});

test("a screen reached from a card (Accounting from Overview) slides in like any other level down", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.getByText("Profit & loss").click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/accounting$/);
});

test("the payee page slides in from the To Pay list (it was fading before)", async ({ page }) => {
  await boot(page, "accountant");
  await page.goto("/pay"); await page.waitForTimeout(1200);
  await page.getByText("Coach Nour").first().click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/pay\/c1$/);
});

test("settings go deeper in two steps, each sliding in", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.getByRole("link", { name: "Account" }).click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/account$/);
  await settle(page);
  await page.getByText("Account Settings").click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/account\/profile$/);
});

test("tapping a tab while a level deep fades, it does not play a back slide", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.getByText("Profit & loss").click();
  await settle(page);
  await expect(page).toHaveURL(/\/accounting$/);
  await page.getByRole("link", { name: "Team" }).click();
  expect(slides(await offsets(page))).toBe(false);
  await expect(page).toHaveURL(/\/coaches$/);
});

test("the back button on a deeper screen slides it away to the right", async ({ page }) => {
  await boot(page, "accountant");
  await page.goto("/pay"); await page.waitForTimeout(1200);
  await page.getByText("Coach Nour").first().click();
  await expect(page).toHaveURL(/\/pay\/c1$/);
  await expect(page.getByRole("button", { name: /To Pay/ })).toBeVisible();
  await settle(page);
  await page.getByRole("button", { name: /To Pay/ }).click();
  expect(slides(await offsets(page))).toBe(true);
  await expect(page).toHaveURL(/\/pay$/);
});

test("screens are never rebuilt: the new one survives its slide, and going back returns the same list at the same place", async ({ page }) => {
  await boot(page, "dept_head");
  await page.route(/\/month\//, (route) => route.fallback()); // (data comes from boot)
  await page.goto("/coaches"); await page.waitForTimeout(1200);
  await page.evaluate(() => { const l = document.querySelector("main [data-scroll]") as HTMLElement & { __mark?: string }; l.scrollTop = 40; l.__mark = "team"; });
  await page.getByText("Coach Nour").click();
  await page.waitForTimeout(150);
  await page.evaluate(() => { const ls = [...document.querySelectorAll("main [data-scroll]")] as (HTMLElement & { __mark?: string })[]; ls[ls.length - 1].__mark = "detail"; });
  await settle(page);
  const kept = await page.evaluate(() => {
    const ls = [...document.querySelectorAll("main [data-scroll]")] as (HTMLElement & { __mark?: string })[];
    return { detailSurvived: ls.some((l) => l.__mark === "detail" && getComputedStyle(l).visibility === "visible"), teamKeptHidden: ls.some((l) => l.__mark === "team" && getComputedStyle(l).visibility === "hidden") };
  });
  expect(kept).toEqual({ detailSurvived: true, teamKeptHidden: true });
  await page.getByRole("button", { name: /Team/ }).first().click();
  await settle(page);
  const back = await page.evaluate(() => { const l = ([...document.querySelectorAll("main [data-scroll]")] as (HTMLElement & { __mark?: string })[]).find((x) => x.__mark === "team"); return { same: !!l, visible: l ? getComputedStyle(l).visibility : null }; });
  expect(back).toEqual({ same: true, visible: "visible" });
});

test("a screen kept underneath does not re-request data when the app refreshes", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/coaches"); await page.waitForTimeout(1200);
  await page.getByText("Coach Nour").click();
  await expect(page).toHaveURL(/\/coaches\/c1$/);
  await settle(page);
  let monthCalls = 0;
  page.on("request", (r) => { if (/\/month\//.test(r.url())) monthCalls++; });
  // Coming back to the app refreshes what's open.
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForTimeout(800);
  // Only the open screen asks (Coach detail: one month call); Team underneath stays quiet.
  expect(monthCalls).toBe(1);
  // Going back shows Team, which catches up once.
  await page.getByRole("button", { name: /Team/ }).first().click();
  await settle(page);
  expect(monthCalls).toBe(2);
});

test("how long each screen takes, and how the phone feels, are measured (numbers only)", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/"); await page.waitForTimeout(1500);
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  const events = await page.evaluate(() => (window as unknown as { __bqEvents: { name: string; props: Record<string, unknown> }[] }).__bqEvents);
  const screen = events.find((e) => e.name === "screen_ready" && e.props.path === "/coaches");
  expect(screen).toBeTruthy();
  expect(typeof screen?.props.ms).toBe("number");
  const vitals = events.find((e) => e.name === "web_vitals");
  expect(vitals).toBeTruthy();
  for (const [k, v] of Object.entries(vitals!.props)) if (k !== "net") expect(["number", "object"]).toContain(typeof v); // numbers (or null); the only word is the connection type (4g, 3g…)
});

test("the title follows the screen you're on: it fades between screens and comes back right after going back", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/coaches"); await page.waitForTimeout(1200);
  const pill = page.locator("div[style*='position: fixed'][style*='top: 0'] div[style*='border-radius: 999px']");
  const team = (await pill.innerText()).trim();
  await page.getByText("Coach Nour").click();
  // mid-change both titles are present (old fading out, new fading in)
  await expect.poll(() => pill.locator("span").count(), { intervals: [15], timeout: 2500 }).toBeGreaterThanOrEqual(3);
  await settle(page);
  const detail = (await pill.innerText()).trim();
  expect(detail).not.toBe(team);
  await page.getByRole("button", { name: /Team/ }).first().click();
  await settle(page);
  expect((await pill.innerText()).trim()).toBe(team);
});

test("the title bar vanishes at once on the home screen (no stale title fading out)", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/coaches"); await page.waitForTimeout(1200);
  const bar = page.locator("div[style*='position: fixed'][style*='top: 0']").first();
  await expect(bar).toHaveCSS("visibility", "visible");
  // Overview is the founder's home: the bar must be gone in the very first frames, not fading with the old title.
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.waitForTimeout(40);
  await expect(bar).toHaveCSS("visibility", "hidden");
  await expect(bar).toHaveCSS("opacity", "0");
});

test("the title bar never shows another screen's title: not when leaving home, not when returning to it", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight"); await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const w = window as unknown as { __bad: string[] };
    w.__bad = [];
    const tick = () => {
      const bar = document.querySelector("div[style*='position: fixed'][style*='top: 0']") as HTMLElement | null;
      if (bar) {
        const cs = getComputedStyle(bar);
        const text = (bar.innerText || "").trim();
        if (cs.visibility === "visible" && Number(cs.opacity) > 0.02 && /Overview/.test(text) && location.pathname !== "/oversight") w.__bad.push(`${location.pathname}:${text}:${cs.opacity}`);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  for (const [name, wait] of [["Team", 700], ["Overview", 700], ["Clients", 700], ["Overview", 700]] as const) {
    await page.getByRole("link", { name, exact: true }).first().click();
    await page.waitForTimeout(wait);
  }
  expect(await page.evaluate(() => (window as unknown as { __bad: string[] }).__bad)).toEqual([]);
});

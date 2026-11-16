import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// One rule per kind of thing, and nested shapes follow outer = inner + padding.
// card 28 · sheet 40 · item 20 (sheet 40 − padding 20) · chip 8 · button 24 · float 32 (24 + 8) · tab bar 32 (26 + 6)

test.use({ viewport: { width: 390, height: 1400 } });

test("every main card, tile and chart on Overview has the same 28px corner", async ({ page }) => {
  const months = [{ month: "2026-10", revenue: 9000, payouts: 3000, profit: 6000 }, { month: "2026-11", revenue: 12000, payouts: 4000, profit: 8000 }];
  await mockBackend(page, "dept_head", { revenue: { months, totals: { revenue: 21000, payouts: 7000, profit: 14000 }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 0, groupPlans: 0, ptPackages: 0, byPlanKind: {} }, walletLiability: 0 } });
  await page.goto("/oversight");
  await expect(page.getByText("REVENUE VS COACH PAYOUTS")).toBeVisible();
  const radii = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("main div")].filter((d) => {
      const cs = getComputedStyle(d);
      return cs.borderTopWidth === "1px" && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && d.getBoundingClientRect().height > 100 && parseFloat(cs.borderTopLeftRadius) > 0;
    });
    return cards.map((d) => parseFloat(getComputedStyle(d).borderTopLeftRadius));
  });
  expect(radii.length).toBeGreaterThanOrEqual(6); // hero, four tiles, chart (and more)
  expect(new Set(radii)).toEqual(new Set([28]));
});

test("a bottom sheet is 40 and what sits in it is 20 (40 − 20 padding)", async ({ page }) => {
  await mockBackend(page, "dept_head", { revenue: { months: [], totals: { revenue: 0, payouts: 0, profit: 0 }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 0, groupPlans: 0, ptPackages: 0, byPlanKind: {} }, walletLiability: 0 } });
  await page.goto("/oversight");
  await page.getByRole("button", { name: "Create" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const dlg = document.querySelector("[role=dialog]")!;
    const panel = [...dlg.querySelectorAll("div")].find((d) => parseFloat(getComputedStyle(d).borderTopLeftRadius) === 40) as HTMLElement | undefined;
    const pad = panel ? parseFloat(getComputedStyle(panel).paddingLeft) : -1;
    const rows = [...dlg.querySelectorAll("button")].filter((b) => /Group class|Class bundle|Membership/.test(b.textContent || "")).map((b) => parseFloat(getComputedStyle(b).borderTopLeftRadius));
    return { sheet: panel ? parseFloat(getComputedStyle(panel).borderTopLeftRadius) : -1, pad, rows };
  });
  expect(r.sheet).toBe(40);
  expect(r.pad).toBe(20);
  expect(r.rows.length).toBeGreaterThan(0);
  for (const row of r.rows) expect(row).toBe(r.sheet - r.pad);
});

test("the tab bar hugs its contents: even gap on every side, corner = circle radius + gap", async ({ page }) => {
  for (const width of [390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await mockBackend(page, "dept_head", {});
    await page.goto("/oversight");
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const links = [...document.querySelectorAll("a[aria-label]")].filter((a) => (a as HTMLElement).title) as HTMLElement[];
      const bar = links[0].parentElement as HTMLElement;
      const b = bar.getBoundingClientRect();
      const first = links[0].getBoundingClientRect();
      const last = links[links.length - 1].getBoundingClientRect();
      const border = parseFloat(getComputedStyle(bar).borderTopWidth);
      return { left: first.left - b.left - border, right: b.right - last.right - border, top: first.top - b.top - border, bottom: b.bottom - first.bottom - border, size: first.width, radius: parseFloat(getComputedStyle(bar).borderTopLeftRadius), border };
    });
    expect(Math.abs(m.left - m.top)).toBeLessThan(0.6);
    expect(Math.abs(m.right - m.bottom)).toBeLessThan(0.6);
    expect(Math.abs(m.top - m.bottom)).toBeLessThan(0.6);
    expect(m.radius).toBeCloseTo(m.size / 2 + m.top + m.border, 0);
  }
});

test("floating actions: container 32 = button 24 + 8 padding", async ({ page }) => {
  const now = new Date();
  const THIS = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const row = { coachId: "c1", name: "Coach Nour", email: "c1@x.com", role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 250, count: 4, groupTotal: 1000, privateTotal: 0, packageCount: 0, total: 1000, state: "logging", settledAt: null, paidAt: null, paidAmount: 0, remaining: 1000 };
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head", { [`month/${THIS}`]: { rows: [row] }, [`sessions/c1/${THIS}`]: { sessions: [] }, [`packages/by-coach/c1/${THIS}`]: { packages: [] } });
  await page.goto("/coaches/c1");
  const btn = page.getByRole("button", { name: "Settle month" });
  await expect(btn).toBeVisible();
  const r = await btn.evaluate((el: HTMLElement) => {
    const box = el.parentElement as HTMLElement;
    const rad = (e: HTMLElement) => parseFloat(getComputedStyle(e).borderTopLeftRadius);
    return { button: rad(el), box: rad(box), pad: parseFloat(getComputedStyle(box).paddingLeft) };
  });
  expect(r.button).toBe(24);
  expect(r.box).toBe(r.button + r.pad);
});

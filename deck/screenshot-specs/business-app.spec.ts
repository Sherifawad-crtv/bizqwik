import { test } from "@playwright/test";
import { mockBackend } from "./mocks";
const OUT = "/tmp/claude-0/-home-user-bizqwik/ab89842c-75ea-5135-934f-23e46fe89c2a/scratchpad/shots2";
const now = new Date();
const ym = (b: number) => { const d = new Date(now.getFullYear(), now.getMonth() - b, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
const THIS = ym(0), LAST = ym(1);
const row = (id: string, name: string, state: string, total: number, extra: Record<string, unknown> = {}) => ({ coachId: id, name, email: id + "@x.com", role: "coach", avatarUrl: null, tierId: "t", tierName: "Senior", rate: 150, count: Math.round(total / 150), groupTotal: total, privateTotal: 0, packageCount: 0, total, state, settledAt: state === "logging" ? null : "2026-09-30T10:00:00Z", paidAt: state === "paid" ? "2026-10-02T10:00:00Z" : null, ...extra });
const ROWS = [row("c1", "Coach Nour", "settled", 4200), row("c2", "Coach Omar", "paid", 3600), row("c3", "Coach Lina", "logging", 2400)];
const REVENUE = { months: [{ month: THIS, revenue: 48000, payouts: 10200, profit: 37800 }], totals: { revenue: 48000, payouts: 10200, profit: 37800 }, byService: [{ key: "group", label: "Group training", amount: 36000 }, { key: "pt", label: "Personal training", amount: 12000 }], byType: [{ key: "membership", label: "Memberships", amount: 30000 }], byCoach: [], activeSubscribers: { total: 112, groupPlans: 96, ptPackages: 16, byPlanKind: {} }, walletLiability: 5000 };
const ACTIVITY = { activity: [
  { id: "a1", type: "sale_plan", amount: 4000, clientName: "Nour", meta: { name: "1 Month", payMethod: "cash" }, at: "2026-10-10T10:00:00Z" },
  { id: "a2", type: "sale_plan", amount: 1800, clientName: "Omar", meta: { name: "10-Class Pack", payMethod: "instapay" }, at: "2026-10-11T10:00:00Z" } ] };
async function shot(page: any, name: string) { await page.waitForTimeout(3500); await page.screenshot({ path: OUT + "/" + name + ".png" }); }
const earlier: Record<string, unknown> = {}; for (let i = 2; i <= 12; i++) if (ym(i).slice(0, 4) === THIS.slice(0, 4)) earlier["month/" + ym(i)] = { rows: [] };
const month = { ...earlier, ["month/" + THIS]: { rows: ROWS }, ["month/" + LAST]: { rows: ROWS.slice(0, 1) }, revenue: REVENUE, activity: ACTIVITY };

test.use({ deviceScaleFactor: 2 });
test("accountant tablet", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 826 });
  await mockBackend(page, "accountant", month);
  await page.goto("/pay"); await shot(page, "accountant-pay");
  await page.goto("/revenue"); await shot(page, "accountant-revenue");
});
test("founder tablet", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 826 });
  await mockBackend(page, "dept_head", month);
  await page.goto("/"); await shot(page, "founder-home");
  await page.goto("/oversight"); await shot(page, "founder-oversight");
  await page.goto("/money"); await shot(page, "founder-money");
});
test("coach phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "coach", { ["month/" + THIS]: { rows: [{ ...ROWS[2], coachId: "prof-zz", name: "Coach", tierName: "Senior", count: 16, groupTotal: 2400, total: 2400 }] }, ["prof-zz/" + THIS]: { sessions: [1,2,3,4,5,6,7].map((d) => ({ id: "s" + d, coachId: "prof-zz", month: THIS, date: THIS + "-" + String(d).padStart(2, "0"), createdBy: "prof-zz", source: "qr" })) } });
  await page.goto("/"); await shot(page, "coach-home");
});
test("front desk phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install({ time: new Date(new Date().setHours(9, 0, 0, 0)) });
  await mockBackend(page, "front_desk", { classes: { classes: [7, 9, 18].map((h, i) => { const t = new Date(); t.setHours(h + 9, 0, 0, 0); return { id: "k" + i, seriesId: "s" + i, title: ["Sunrise HIIT", "Power Yoga", "Boxing"][i], description: null, startsAt: t.toISOString(), price: 150, status: "active", bookedCount: 8 - i }; }) }, "front-desk/summary": { todayCheckIns: 14, todayDropIns: 3, activeNow: 6, recent: [] } });
  await page.goto("/"); await shot(page, "desk-home");
});

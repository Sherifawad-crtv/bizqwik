import { test } from "@playwright/test";
import { mockBackend } from "./mocks";
const OUT = "/tmp/claude-0/-home-user-bizqwik/ab89842c-75ea-5135-934f-23e46fe89c2a/scratchpad/shots5";
const now = new Date();
const ym = (b: number) => { const d = new Date(now.getFullYear(), now.getMonth() - b, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
const THIS = ym(0), LAST = ym(1);
const row = (id: string, name: string, state: string, total: number, extra: Record<string, unknown> = {}) => ({ coachId: id, name, email: id + "@x.com", role: "coach", avatarUrl: null, tierId: "t", tierName: "Senior", rate: 150, count: Math.round(total / 150), groupTotal: total, privateTotal: 0, packageCount: 0, total, state, settledAt: state === "logging" ? null : "2026-09-30T10:00:00Z", paidAt: state === "paid" ? "2026-10-02T10:00:00Z" : null, ...extra });
const ROWS = [
  row("c1", "Coach Nour", "settled", 31200, { count: 208 }), row("c2", "Coach Omar", "paid", 28800, { count: 192 }), row("c3", "Coach Lina", "logging", 24600, { count: 164 }),
  row("c4", "Coach Karim", "settled", 22500, { count: 150 }), row("c5", "Coach Salma", "paid", 19800, { count: 132 }), row("c6", "Coach Tarek", "logging", 17400, { count: 116 }),
];
// A year of growth, ~330k -> ~590k a month; coach payouts ~29% of revenue.
const REV = [318000, 371000, 334000, 392000, 351000, 436000, 489000, 447000, 523000, 498000, 561000, 587400];
const PAY = [92000, 109000, 97000, 114000, 103000, 128000, 143000, 131000, 153000, 146000, 163000, 171300];
const HISTORY = REV.map((r, i) => ({ month: ym(11 - i), revenue: r, payouts: PAY[i], profit: r - PAY[i] }));
const REVENUE = {
  months: HISTORY.slice(-1), history: HISTORY,
  totals: { revenue: 587400, payouts: 171300, profit: 416100 },
  byService: [{ key: "group", label: "Group training", amount: 351200 }, { key: "pt", label: "Personal training", amount: 186400 }, { key: "dropin", label: "Drop-ins", amount: 49800 }],
  byType: [{ key: "membership", label: "Memberships", amount: 318000 }, { key: "bundle", label: "Class bundles", amount: 142600 }, { key: "pt", label: "PT packages", amount: 126800 }],
  byCoach: [], activeSubscribers: { total: 412, groupPlans: 360, ptPackages: 52, byPlanKind: {} }, walletLiability: 38400,
};
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
  await page.setViewportSize({ width: 390, height: 795 });
  await mockBackend(page, "coach", { ["month/" + THIS]: { rows: [{ ...ROWS[2], coachId: "prof-zz", name: "Coach", tierName: "Senior", count: 16, groupTotal: 2400, total: 2400 }] }, ["prof-zz/" + THIS]: { sessions: [1,2,3,4,5,6,7].map((d) => ({ id: "s" + d, coachId: "prof-zz", month: THIS, date: THIS + "-" + String(d).padStart(2, "0"), createdBy: "prof-zz", source: "qr" })) } });
  await page.goto("/"); await shot(page, "coach-home");
});
test("front desk phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 795 });
  await page.clock.install({ time: new Date(new Date().setHours(9, 0, 0, 0)) });
  await mockBackend(page, "front_desk", { classes: { classes: [7, 9, 18].map((h, i) => { const t = new Date(); t.setHours(h + 9, 0, 0, 0); return { id: "k" + i, seriesId: "s" + i, title: ["Sunrise HIIT", "Power Yoga", "Boxing"][i], description: null, startsAt: t.toISOString(), price: 150, status: "active", bookedCount: 8 - i }; }) }, "front-desk/summary": { todayCheckIns: 14, todayDropIns: 3, activeNow: 6, recent: [] } });
  await page.goto("/"); await shot(page, "desk-home");
});

test("front desk calendar tablet (week view)", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 826 });
  await page.clock.install({ time: new Date(new Date().setHours(10, 20, 0, 0)) });
  // The calendar's week runs Saturday to Friday; fill every day with a realistic timetable.
  const sat = new Date(); sat.setHours(0, 0, 0, 0); sat.setDate(sat.getDate() - ((sat.getDay() + 1) % 7));
  const at = (d: number, h: number, m = 0) => { const t = new Date(sat); t.setDate(t.getDate() + d); t.setHours(h, m, 0, 0); return t.toISOString(); };
  const T = ["Sunrise HIIT", "Mobility Flow", "Strength Club", "Reformer Flow", "Power Yoga", "Mat Pilates", "Kids Gym", "Boxing Fundamentals", "Hybrid Engine", "Evening Yoga"];
  const PLAN: [number, number, number][][] = [
    [[0, 9, 0], [4, 10, 30], [2, 17, 0]],                                  // Sat
    [[1, 10, 0], [5, 11, 30], [8, 18, 0]],                                 // Sun
    [[0, 7, 0], [1, 8, 30], [2, 9, 30], [4, 12, 30], [6, 15, 30], [7, 17, 0], [8, 18, 30], [9, 20, 0]], // Mon
    [[0, 7, 0], [3, 9, 30], [5, 14, 0], [2, 17, 30], [9, 19, 30]],         // Tue
    [[1, 8, 0], [4, 12, 0], [6, 16, 0], [7, 18, 0], [8, 19, 30]],          // Wed
    [[0, 7, 0], [2, 9, 30], [3, 11, 0], [5, 15, 0], [7, 17, 30], [9, 20, 0]], // Thu
    [[1, 8, 0], [4, 10, 30], [8, 17, 0]],                                  // Fri
  ];
  const classes = PLAN.flatMap((day, d) => day.map(([t, h, m], i) => ({ id: `k${d}-${i}`, seriesId: `s${t}`, title: T[t], description: null, startsAt: at(d, h, m), price: 250, status: "active", bookedCount: 6 + ((d * 7 + i * 5 + t * 3) % 15) })));
  await mockBackend(page, "front_desk", { "front-desk/summary": { todayCheckIns: 14, todayDropIns: 3, activeNow: 6, recent: [] }, classes: { classes } });
  await page.goto("/desk-classes");
  await page.waitForTimeout(3000);
  await page.screenshot({ path: OUT + "/desk-calendar.png" });
});

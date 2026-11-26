import { test, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mockBackend } from "./mocks";
import type { Role } from "../src/shared/types";

// "Nothing moved" guard for the architecture clean-up. Each main screen, per
// role, on phone and desktop, is reduced to the computed styles of every
// visible element (colours, type, spacing, radius, shadows, sizes, layout). Those are
// compared with the committed baseline in e2e/visual-baseline/. Computed
// styles don't depend on which fonts the machine has, so the same baseline
// holds locally and in CI.
//
// Refresh the baseline only when a change is MEANT to look different:
//   UPDATE_VISUAL=1 npx playwright test e2e/visual.spec.ts

const here = dirname(fileURLToPath(import.meta.url));
const BASE_DIR = join(here, "visual-baseline");
const UPDATE = !!process.env.UPDATE_VISUAL;

const PROPS = [
  "display", "position", "flex-direction", "flex-wrap", "align-items", "justify-content", "gap",
  "grid-template-columns", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left", "border-top-width", "border-bottom-width",
  "border-left-width", "border-right-width", "border-top-color", "border-top-style", "border-top-left-radius",
  "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius", "background-color",
  "background-image", "color", "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
  "text-transform", "text-align", "white-space", "opacity", "box-shadow", "overflow-x", "overflow-y",
  "min-height", "max-width", "height", "width", "z-index", "text-decoration-line", "font-variant-numeric",
];

const now = new Date("2026-10-15T10:00:00");
const ym = (back: number) => {
  const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const THIS = ym(0);
const LAST = ym(1);
const coachRow = (id: string, name: string, total: number, state: string) => ({
  coachId: id, name, email: `${id}@x.com`, role: "coach", avatarUrl: null, tierId: "t", tierName: "Tier 1", rate: 150, count: 4,
  groupTotal: total, privateTotal: 0, packageCount: 0, total, state, settledAt: state === "logging" ? null : "2026-10-10T10:00:00Z", paidAt: null,
});
const DATA: Record<string, unknown> = {
  [`month/${THIS}`]: { rows: [coachRow("c1", "Coach Nour", 1200, "settled"), coachRow("c2", "Coach Adam", 900, "logging")] },
  [`month/${LAST}`]: { rows: [coachRow("c1", "Coach Nour", 2000, "paid")] },
  [`sessions/c1/${THIS}`]: { sessions: [] },
  [`packages/by-coach/c1/${THIS}`]: { packages: [] },
  activity: { activity: [] },
  "front-desk/summary": { todayCheckIns: 3, todayDropIns: 1, activeNow: 1, recent: [] },
  revenue: {
    months: [{ month: LAST, revenue: 3000, payouts: 800, profit: 2200 }, { month: THIS, revenue: 3500, payouts: 900, profit: 2600 }],
    totals: { revenue: 6500, payouts: 1700, profit: 4800 },
    byService: [], byType: [], byCoach: [],
    activeSubscribers: { total: 7, groupPlans: 7, ptPackages: 0, byPlanKind: {} }, walletLiability: 0,
  },
  "payments/summary": {
    months: 1, total: 3500,
    byMethod: [{ method: "instapay", label: "InstaPay", amount: 2500, count: 5 }, { method: "cash", label: "Cash", amount: 1000, count: 2 }],
    transfers: [{ id: "t1", at: "2026-10-14T09:00:00Z", clientName: "Mona Ali", amount: 500, what: "Monthly" }],
  },
  "accounting/categories": { categories: [{ id: "cat-rent", name: "Rent", sortOrder: 1, isDefault: true, archived: false }] },
  "accounting/expenses": { expenses: [{ id: "e1", categoryId: "cat-rent", categoryName: "Rent", amount: 12000, date: `${THIS}-01`, note: "October rent", hasReceipt: false, receiptUrl: null, recurringId: null, createdBy: "me", editedAfterMonthEnd: false }] },
  "accounting/recurring": { recurring: [] },
  "accounting/pnl": {
    month: THIS,
    current: { month: THIS, grossRevenue: 20000, refunds: 1000, netRevenue: 19000, coachPayouts: 4000, otherExpenses: 13500, totalExpenses: 17500, profit: 1500 },
    trend: [LAST, THIS].map((m) => ({ month: m, grossRevenue: 20000, refunds: 0, netRevenue: 20000, coachPayouts: 4000, otherExpenses: 12000, totalExpenses: 16000, profit: 4000 })),
    revenueBySource: [{ key: "group", label: "Group training", amount: 15000 }],
    expensesBySource: [{ key: "coach_payouts", label: "Coach payouts", amount: 4000, paid: 1500 }, { key: "cat-rent", label: "Rent", amount: 12000 }],
    hasPastExpenses: true,
    unsettledNote: { count: 2 },
  },
  "ops/summary": { totalOrgs: 0, activeOrgs: 0, totalGmv: 0, bizqwikRevenue: 0 },
  "ops/orgs": { orgs: [] },
  "ops/plans": { plans: [] },
  clients: {
    clients: [
      { id: "m1", name: "Mona Salah", phone: "01000000001", email: null, kind: "adult", createdAt: "2026-09-01T00:00:00Z" },
      { id: "m2", name: "Karim Fathy", phone: "01000000002", email: null, kind: "kid", createdAt: "2026-09-02T00:00:00Z" },
    ],
  },
};

interface Screen { name: string; role: Role | "ops" | null; path: string; solo?: boolean }
const SCREENS: Screen[] = [
  { name: "login", role: null, path: "/login" },
  { name: "forgot-password", role: null, path: "/forgot-password" },
  { name: "reset-password", role: null, path: "/reset-password" },
  { name: "coach-home", role: "coach", path: "/" },
  { name: "coach-history", role: "coach", path: "/history" },
  { name: "head-coach-team", role: "head_coach" as Role, path: "/coaches" },
  { name: "founder-overview", role: "dept_head", path: "/oversight" },
  { name: "founder-team", role: "dept_head", path: "/coaches" },
  { name: "founder-coach", role: "dept_head", path: "/coaches/c1" },
  { name: "founder-clients", role: "dept_head", path: "/clients" },
  { name: "founder-catalog", role: "dept_head", path: "/catalog" },
  { name: "accountant-pay", role: "accountant", path: "/pay" },
  { name: "accountant-money", role: "accountant", path: "/transactions" },
  { name: "accountant-accounting", role: "accountant", path: "/accounting" },
  { name: "desk-home", role: "front_desk", path: "/" },
  { name: "desk-bookings", role: "front_desk", path: "/bookings" },
  { name: "desk-members", role: "front_desk", path: "/members" },
  { name: "desk-activity", role: "front_desk", path: "/activity" },
  { name: "solo-today", role: "dept_head", path: "/", solo: true },
  { name: "solo-money", role: "dept_head", path: "/money", solo: true },
  { name: "account", role: "front_desk", path: "/account" },
  { name: "ops-overview", role: "ops", path: "/bizqwik" },
];

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
];

async function snapshot(page: Page): Promise<string[]> {
  return page.evaluate((props) => {
    const out: string[] = [];
    const key = (el: Element): string => {
      const parts: string[] = [];
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        const i = e.parentElement ? Array.prototype.indexOf.call(e.parentElement.children, e) : 0;
        parts.unshift(`${e.tagName.toLowerCase()}${i}`);
      }
      return parts.join(">");
    };
    for (const el of Array.from(document.body.querySelectorAll("*"))) {
      if (el.closest("script,style,noscript")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden") continue;
      // computedStyleMap gives the computed value before layout (margin stays
      // "auto", grid columns stay "1fr 90px"), so the snapshot doesn't depend
      // on how wide the machine's fonts render text.
      const map = el.computedStyleMap();
      // Two parts size themselves by measuring their text (the page-title pill
      // and a segmented control's sliding thumb), so their width differs
      // between machines' fonts: left out. Every other size is checked.
      const measured = el.matches(".bq-shell-title-pill, .bq-use-sliding-thumb-layer");
      const val = (p: string) => {
        if ((p === "width" || p === "height") && measured) return "measured";
        try {
          return String(map.get(p) ?? cs.getPropertyValue(p));
        } catch {
          return cs.getPropertyValue(p);
        }
      };
      out.push(`${key(el)} ${props.map((p) => `${p}:${val(p)}`).join(";")}`);
    }
    return out;
  }, PROPS);
}

for (const vp of VIEWPORTS) {
  for (const s of SCREENS) {
    test(`looks unchanged: ${s.name} (${vp.name})`, async ({ page }) => {
      await page.clock.install({ time: now });
      await page.clock.resume();
      await page.emulateMedia({ reducedMotion: "reduce" });
      // Web fonts are left out on purpose: the snapshot is about our styles.
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
      await page.setViewportSize({ width: vp.width, height: vp.height });
      if (s.role === null) {
        await mockBackend(page, "front_desk", DATA, false);
      } else if (s.role === "ops") {
        await mockBackend(page, "front_desk", DATA);
        await page.route(/\/functions\/v1\/make-server-980e1cbf\/me$/, (r) =>
          r.fulfill({
            status: 200,
            headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
            body: JSON.stringify({ profile: null, tier: null, bizqwikTeam: { id: "b1", name: "Ops Person", email: "o@x.com", role: "founder" } }),
          }),
        );
      } else {
        await mockBackend(page, s.role, { ...DATA, ...(s.solo ? { __orgMode: "solo" } : {}) });
      }
      await page.goto(s.path);
      await page.waitForLoadState("networkidle");
      // Wait until nothing is loading (no spinner or skeleton animating) and
      // three reads in a row are identical (values settled).
      const busy = () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll("body *")).some((el) => {
            const a = getComputedStyle(el).animationName;
            return (a.includes("bqSpin") || a.includes("bqSkel")) && el.getBoundingClientRect().width > 0;
          }),
        );
      let lines = await snapshot(page);
      let same = 0;
      for (let i = 0; i < 30 && same < 2; i++) {
        await page.waitForTimeout(300);
        const next = await snapshot(page);
        same = next.join("\n") === lines.join("\n") && !(await busy()) ? same + 1 : 0;
        lines = next;
      }
      expect(lines.length).toBeGreaterThan(5);

      const file = join(BASE_DIR, `${s.name}.${vp.name}.txt`);
      if (UPDATE || !existsSync(file)) {
        mkdirSync(BASE_DIR, { recursive: true });
        writeFileSync(file, lines.join("\n") + "\n");
        return;
      }
      const before = readFileSync(file, "utf8").trimEnd().split("\n");
      const diffs: string[] = [];
      const max = Math.max(before.length, lines.length);
      for (let i = 0; i < max && diffs.length < 15; i++) {
        if (before[i] === lines[i]) continue;
        const b = before[i] ?? "(missing)";
        const a = lines[i] ?? "(missing)";
        const [bk, bs = ""] = b.split(" ");
        const [, as = ""] = a.split(" ");
        const bm = new Map(bs.split(";").map((x) => [x.slice(0, x.indexOf(":")), x] as const));
        const changed = as.split(";").filter((x) => bm.get(x.slice(0, x.indexOf(":"))) !== x);
        diffs.push(`${bk}\n    before: ${changed.map((c) => bm.get(c.slice(0, c.indexOf(":")))).join("; ") || b}\n    after:  ${changed.join("; ") || a}`);
      }
      expect(diffs, `${s.name} (${vp.name}) changed:\n${diffs.join("\n")}`).toEqual([]);
    });
  }
}

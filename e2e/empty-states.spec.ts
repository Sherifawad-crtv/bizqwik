import { test, expect, type Page, type Route } from "@playwright/test";
import type { Role } from "../src/lib/types";
import { mockBackend } from "./mocks";

// A brand-new org with nothing in it: every list, picker and sheet should say
// what's missing and how to fix it, never render blank.
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const now = new Date();
const MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;


function emptyFor(path: string, role: Role | "ops"): unknown {
  const p = path.replace(/^.*make-server-980e1cbf\//, "");
  const self = { coachId: "me", name: "Zed", email: "a@b.c", role, avatarUrl: null, tierId: null, tierName: null, rate: 0, count: 0, groupTotal: 0, privateTotal: 0, packageCount: 0, total: 0, state: "logging", settledAt: null, paidAt: null };
  if (p === "me") return role === "ops" ? { profile: null, tier: null, bizqwikTeam: { id: "t", name: "Ops", email: "o@b.c", role: "founder" } } : { profile: { id: "me", email: "a@b.c", name: "Zed Person", role, tierId: null, avatarUrl: null }, tier: null, bizqwikTeam: null };
  if (p.startsWith("month/")) return { rows: role === "coach" || role === "head_coach" ? [self] : [] };
  if (p.startsWith("sessions/")) return { sessions: [] };
  if (p.startsWith("packages/by-coach")) return { packages: [] };
  if (p.startsWith("group-plans/client")) return { activePlan: null, plans: [] };
  if (p.startsWith("revenue")) return { months: [{ month: MONTH, revenue: 0, payouts: 0, profit: 0 }], totals: { revenue: 0, payouts: 0, profit: 0 }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 0, groupPlans: 0, ptPackages: 0, byPlanKind: { membership: 0, class_monthly: 0, bundle: 0 } }, walletLiability: 0 };
  if (p.startsWith("activity")) return { activity: [] };
  if (p.startsWith("classes/") && p.endsWith("/bookings")) return { bookings: [] };
  const m: Record<string, unknown> = {
    tiers: { tiers: [] }, "bundle-types": { bundleTypes: [] }, clients: { clients: [] }, invites: { invites: [] }, profiles: { profiles: [] },
    coaches: { coaches: [] }, "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] }, "class-series": { series: [] },
    "plan-types": { planTypes: [] }, classes: { classes: [] }, "push/vapid-public-key": { publicKey: "x" },
    "ops/summary": { totalOrgs: 0, activeOrgs: 0, totalGmv: 0, bizqwikRevenue: 0 }, "ops/orgs": { orgs: [] }, "ops/team": { members: [], invites: [] }, "ops/plans": { plans: [] },
  };
  return m[p] ?? {};
}

async function boot(page: Page, role: Role | "ops") {
  await mockBackend(page, role === "ops" ? "dept_head" : role);
  // Registered after mockBackend, so it wins: an empty org for every endpoint.
  await page.route(/\/functions\/v1\/make-server-980e1cbf\//, (r: Route) => {
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: CORS });
    return r.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(emptyFor(new URL(r.request().url()).pathname, role)) });
  });
}


test.use({ viewport: { width: 390, height: 844 } });

test("empty org: dropdowns with no options explain why instead of opening blank", async ({ page }) => {
  await boot(page, "front_desk");
  await page.goto("/members");
  await page.getByRole("button", { name: "+ New client" }).first().click();
  await page.getByLabel("FULL NAME", { exact: true }).fill("Test Client");
  await page.getByLabel("PHONE", { exact: true }).fill("0100");
  await page.getByLabel("EMAIL", { exact: true }).fill("test@client.dev");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "PT PACKAGE" }).click();
  await expect(page.getByText("No PT packages yet").first()).toBeVisible();
  await page.getByText("PACKAGE", { exact: true }).click();
  await expect(page.getByText("The department head adds PT packages in Catalog → PT bundles.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();
  await page.getByText("COACH", { exact: true }).click();
  await expect(page.getByText("No coaches yet").last()).toBeVisible();
});

test("empty org: front desk search screens point to adding the first client", async ({ page }) => {
  await boot(page, "front_desk");
  await page.goto("/checkin");
  await expect(page.getByText("No clients yet")).toBeVisible();
  await page.getByRole("button", { name: "+ New client" }).click();
  // The new-client flow opens right here, over the screen.
  await expect(page).toHaveURL(/\/checkin$/);
  await expect(page.getByText("Client info").first()).toBeVisible();
  await page.goto("/invitations");
  await expect(page.getByText("No clients yet")).toBeVisible();
  await page.getByRole("button", { name: "+ New client" }).click();
  await expect(page).toHaveURL(/\/invitations$/);
  await expect(page.getByText("Client info").first()).toBeVisible();
});

test("empty org: dept head Team links straight to inviting someone", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/coaches");
  await expect(page.getByText("No coaches on the team yet")).toBeVisible();
  await page.getByRole("button", { name: "Invite someone" }).click();
  // The invite form opens right here — no trip to another page.
  await expect(page).toHaveURL(/\/coaches$/);
  await expect(page.getByText("NEW INVITE")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.goto("/manage?tab=invites");
  await expect(page.getByText("No pending invites")).toBeVisible();
  await page.getByRole("button", { name: "+ Invite someone" }).click();
  await expect(page.getByText("No pay tiers yet — create one in the Tiers tab", { exact: false })).toBeVisible();
});

test("empty org: money overview and catalog explain what fills them", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight");
  await expect(page.getByText("No sales or payouts yet")).toBeVisible();
  await page.goto("/catalog");
  await expect(page.getByText("No classes yet")).toBeVisible();
  await page.getByRole("button", { name: "PT BUNDLES" }).click();
  await expect(page.getByText("No PT bundles yet")).toBeVisible();
});

test("empty ops dashboard: every list has a next step", async ({ page }) => {
  await boot(page, "ops");
  await page.goto("/bizqwik");
  await expect(page.getByText("No organizations yet")).toBeVisible();
  await page.goto("/bizqwik/team");
  await expect(page.getByText("No team members yet")).toBeVisible();
  await page.goto("/bizqwik/plans");
  await expect(page.getByText("No SaaS plans yet")).toBeVisible();
});

test("empty month: coach home and clients say what shows up there", async ({ page }) => {
  await boot(page, "coach");
  await page.goto("/");
  await expect(page.getByText("Tap + and scan the coaches' room QR", { exact: false })).toBeVisible();
  await page.goto("/clients");
  await expect(page.getByText("No PT clients yet")).toBeVisible();
});

test("dept head: the Create button offers Invite and Pay tier on any screen and opens them in place", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/oversight");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Invite someone", { exact: true }).click();
  await expect(page.getByText("NEW INVITE")).toBeVisible();
  await expect(page).toHaveURL(/\/oversight$/);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Pay tier", { exact: true }).click();
  await expect(page.getByText("NEW TIER", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/oversight$/);
});

test("empty org: dept head Sessions screen adds a class in place", async ({ page }) => {
  await boot(page, "dept_head");
  await page.goto("/classes");
  await expect(page.getByText("No sessions yet")).toBeVisible();
  await page.getByRole("button", { name: "+ New class" }).click();
  await expect(page).toHaveURL(/\/classes$/);
  await expect(page.getByText("New class", { exact: true })).toBeVisible();
});

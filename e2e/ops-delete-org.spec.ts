import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// Ops: deleting an org sits in a danger zone on the org page and only
// unlocks once the org's slug is typed exactly.

const ORG = {
  org: { id: "org-t", name: "Test Gym", slug: "test-gym", coachQrToken: "bqc_x", status: "trial", planId: null, planName: null, createdAt: "2026-09-24T10:00:00Z" },
  plan: null,
  staff: [],
  pendingInvites: [],
  usage: { staffCount: 2, clientCount: 5, sessionsLogged: 0, packagesSold: 0, membershipsSold: 0, dropInsSold: 0, gmv: 0, lastActivity: null },
};

test("ops: delete an org after typing its slug", async ({ page }) => {
  let deleted: Record<string, unknown> | null = null;
  await mockBackend(page, "dept_head", {
    "ops/orgs/org-t": ORG,
    "ops/plans": { plans: [] },
    config: { branding: null, settings: null },
    "ops/orgs/org-t/delete": (b) => {
      deleted = b;
      return { body: { ok: true, name: "Test Gym", loginsRemoved: 3 } };
    },
    "ops/summary": { totalOrgs: 0, activeOrgs: 0, totalGmv: 0, bizqwikRevenue: 0 },
    "ops/orgs": { orgs: [] },
  });
  // Signed in as a Bizqwik team member (no org profile).
  await page.route(/\/make-server-980e1cbf\/me$/, (route) =>
    route.fulfill({
      status: 200,
      headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
      body: JSON.stringify({ profile: null, tier: null, bizqwikTeam: { id: "t1", name: "Ops", email: "ops@bizqwik.dev", role: "founder" } }),
    }),
  );

  await page.goto("/bizqwik/orgs/org-t");
  await expect(page.getByText("Danger zone", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Delete Test Gym?")).toBeVisible();
  await expect(page.getByText(/its 2 staff and 5 members/)).toBeVisible();

  const go = page.getByRole("button", { name: "Delete permanently" });
  await expect(go).toBeDisabled();
  await page.getByLabel("TYPE TEST-GYM TO CONFIRM").fill("test");
  await expect(go).toBeDisabled();
  await page.getByLabel("TYPE TEST-GYM TO CONFIRM").fill("test-gym");
  await go.click();

  await expect(page).toHaveURL(/\/bizqwik$/);
  expect(deleted).toEqual({ confirmSlug: "test-gym" });
});

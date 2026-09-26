import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// Front desk manual check-in: a class bundle loses one session (at most one a
// day); a bundle with nothing left is refused with a clear "no sessions" box.
const bundle = (creditsRemaining: number, status = "active") => ({
  id: "gp-1", clientId: "cl-1", kind: "bundle", planTypeId: "pt-1", seriesId: null, name: "10 Classes", priceAtSale: 1000, payMethod: "cash",
  creditsTotal: 10, creditsRemaining, invitationsRemaining: 0, startsAt: "2026-09-01T00:00:00Z", expiresAt: "2099-01-01T00:00:00Z", status, createdAt: "2026-09-01T00:00:00Z",
});
const client = (groupPlan: unknown) => ({ id: "cl-1", name: "Mona Samir", age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan });

test("front desk: checking in a bundle client uses one session and shows what's left", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await mockBackend(page, "front_desk", {
    clients: { clients: [client(bundle(8))] },
    "check-ins": (b) => {
      sent = b;
      return { body: { checkIn: { id: "ci-1" }, deducted: true, plan: { name: "10 Classes", kind: "bundle", creditsRemaining: 7, creditsTotal: 10 } } };
    },
  });
  await page.goto("/checkin");
  await page.getByRole("button", { name: /Mona Samir/ }).click();
  await expect(page.getByText(/Checking in uses 1 session of 10 Classes \(8 → 7 left\)/)).toBeVisible();
  await page.getByRole("button", { name: "Confirm check-in" }).click();
  await expect(page.getByText("Mona Samir checked in · 7 of 10 sessions left")).toBeVisible();
  expect(sent).toEqual({ clientId: "cl-1", source: "manual" });
});

test("front desk: a used-up bundle shows 'No sessions left' instead of a check-in button", async ({ page }) => {
  await mockBackend(page, "front_desk", {
    clients: { clients: [client(null)] },
    "group-plans/client/cl-1": { activePlan: null, plans: [bundle(0, "finished")] },
  });
  await page.goto("/checkin");
  await page.getByRole("button", { name: /Mona Samir/ }).click();
  const box = page.getByTestId("no-sessions");
  await expect(box).toBeVisible();
  await expect(box).toContainText("Mona Samir has used all 10 sessions of 10 Classes.");
  await expect(page.getByRole("button", { name: "Confirm check-in" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Sell a drop-in pass" })).toBeVisible();
});

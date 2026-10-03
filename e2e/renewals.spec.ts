import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

const days = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const plan = (name: string, endsInDays: number) => ({
  id: "p1", clientId: "x", kind: "membership", planTypeId: null, seriesId: null, name, priceAtSale: 500, payMethod: "instapay",
  creditsTotal: null, creditsRemaining: null, invitationsRemaining: 0, startsAt: days(-20), expiresAt: days(endsInDays), status: "active",
});
const client = (id: string, name: string, phone: string, groupPlan: unknown) => ({ id, name, age: null, phone, email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan });

test("members: 'Ending soon' lists who needs a nudge and opens WhatsApp with a ready message", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__opened = [];
    window.open = ((u: string) => { (window as any).__opened.push(u); return null; }) as any;
  });
  await mockBackend(page, "front_desk", {
    clients: {
      clients: [
        client("c1", "Mona Ali", "010 1234 5678", plan("Monthly", 3)),
        client("c2", "Omar Said", "01099999999", plan("Monthly", 25)),
        client("c3", "Lina Hassan", "01011112222", null),
      ],
    },
  });
  await page.goto("/members");
  await page.getByRole("button", { name: /Ending soon · 1/ }).click();
  await expect(page.getByText("Mona Ali")).toBeVisible();
  await expect(page.getByText("Omar Said")).toHaveCount(0);
  await expect(page.getByText(/Ends in 3 days/)).toBeVisible();

  await page.getByText("Mona Ali").click();
  await page.getByRole("button", { name: "Remind to renew on WhatsApp" }).click();
  const opened: string[] = await page.evaluate(() => (window as any).__opened);
  expect(opened).toHaveLength(1);
  expect(opened[0]).toContain("https://wa.me/2010");
  expect(decodeURIComponent(opened[0])).toContain("Hi Mona!");
  expect(decodeURIComponent(opened[0])).toContain("Monthly");
});

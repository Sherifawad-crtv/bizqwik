import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

async function drag(page: import("@playwright/test").Page, fromY: number, toY: number) {
  await page.evaluate(
    async ({ fromY, toY }) => {
      const target = document.querySelector("[data-scroll]") as HTMLElement;
      const mk = (y: number) => new Touch({ identifier: 1, target, clientX: 195, clientY: y });
      target.dispatchEvent(new TouchEvent("touchstart", { touches: [mk(fromY)], changedTouches: [mk(fromY)], bubbles: true, cancelable: true }));
      for (let y = fromY; y <= toY; y += 20) {
        target.dispatchEvent(new TouchEvent("touchmove", { touches: [mk(y)], changedTouches: [mk(y)], bubbles: true, cancelable: true }));
        await new Promise((r) => setTimeout(r, 16));
      }
      target.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [mk(toY)], bubbles: true, cancelable: true }));
    },
    { fromY, toY },
  );
}

test("pull down from the top reloads the screen from the server", async ({ page }) => {
  let name = "Mona Ali";
  let calls = 0;
  await mockBackend(page, "front_desk", {
    clients: () => {
      calls++;
      return { body: { clients: [{ id: "c1", name, age: null, phone: "0100", email: null, conditions: null, assignedCoachId: null, currentPackage: null, currentMembership: null, groupPlan: null }] } };
    },
  });
  await page.goto("/members");
  await expect(page.getByText("Mona Ali")).toBeVisible();
  name = "Mona Samir"; // changed on another phone
  const before = calls;

  // A short pull isn't enough.
  await drag(page, 200, 260);
  await page.waitForTimeout(300);
  expect(calls).toBe(before);
  await expect(page.getByText("Mona Ali")).toBeVisible();

  // A full pull refreshes.
  await drag(page, 200, 480);
  await expect(page.getByText("Mona Samir")).toBeVisible();
  expect(calls).toBeGreaterThan(before);
});

test("no pull-to-refresh on desktop", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await mockBackend(page, "front_desk");
  await page.goto("/members");
  await expect(page.getByTestId("ptr")).toHaveCount(0);
  await ctx.close();
});

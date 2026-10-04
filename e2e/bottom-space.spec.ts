import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// The empty scrollable space under the last item used to be 230px. Installed as
// an app there's no browser toolbar, so it only needs to clear the bottom bar.
const pad = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll("main div")].find((e) => getComputedStyle(e).overflowY === "auto") as HTMLElement | undefined;
    return el ? parseInt(getComputedStyle(el).paddingBottom, 10) : -1;
  });

test.use({ viewport: { width: 390, height: 844 } });

test("installed as an app: only ~112px under the last item", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { value: true, configurable: true }));
  await mockBackend(page, "dept_head", { __orgMode: "solo", clients: { clients: [] }, classes: { classes: [] }, revenue: { months: [] } });
  await page.goto("/bookings");
  await page.waitForTimeout(800);
  expect(await pad(page)).toBe(112);
});

test("in a browser tab: a smaller buffer than before, never 230px", async ({ page }) => {
  await mockBackend(page, "dept_head", { __orgMode: "solo", clients: { clients: [] }, classes: { classes: [] }, revenue: { months: [] } });
  await page.goto("/bookings");
  await page.waitForTimeout(800);
  expect(await pad(page)).toBe(160);
});

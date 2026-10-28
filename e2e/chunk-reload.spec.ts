import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";
import { isChunkLoadError } from "../src/lib/chunkReload";

// After an update, an app that was already open asks for a screen's file that no
// longer exists, and the server answers with the home page (text/html). The app
// should reload once and carry on — and never loop.

const WELCOME_FILE = "**/routes/Welcome.tsx*";

async function freshVisitor(page: Page) {
  await mockBackend(page, "dept_head", {}, false);
  // A first-time device on every load, including the one after the reload
  // (the mock marks every device as welcomed unless told otherwise).
  await page.addInitScript(() => localStorage.removeItem("bizqwik.welcomed"));
  await page.setViewportSize({ width: 390, height: 844 });
}

const htmlInsteadOfCode = { status: 200, contentType: "text/html", body: "<!doctype html><html><body>index</body></html>" };

test("update: a screen's file that's gone (answered with HTML) reloads the page once and the screen appears", async ({ page }) => {
  await freshVisitor(page);
  let asked = 0;
  await page.route(WELCOME_FILE, (route) => {
    asked++;
    return asked === 1 ? route.fulfill(htmlInsteadOfCode) : route.continue();
  });
  await page.goto("/welcome");
  await expect(page.getByText("Welcome to Bizqwik!")).toBeVisible({ timeout: 15000 });
  expect(asked).toBe(2); // the failed ask, then the one after the reload
});

test("update: if the new version's file is missing too, it reloads once and stops — no loop", async ({ page }) => {
  await freshVisitor(page);
  let asked = 0;
  await page.route(WELCOME_FILE, (route) => {
    asked++;
    return route.fulfill(htmlInsteadOfCode);
  });
  await page.goto("/welcome").catch(() => undefined);
  await page.waitForTimeout(3000);
  expect(asked).toBe(2); // first try, one reload, then it gives up instead of reloading forever
});

test("update: a real error that isn't a missing file doesn't reload anything", async () => {
  expect(isChunkLoadError(new TypeError("'text/html' is not a valid JavaScript MIME type."))).toBe(true); // Safari
  expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/Welcome-1.js"))).toBe(true); // Chrome
  expect(isChunkLoadError(new Error("error loading dynamically imported module"))).toBe(true); // Firefox
  expect(isChunkLoadError(new Error("Importing a module script failed."))).toBe(true); // Safari
  expect(isChunkLoadError(new Error("Cannot read properties of undefined (reading 'name')"))).toBe(false);
  expect(isChunkLoadError(new Error("Network request failed"))).toBe(false);
});

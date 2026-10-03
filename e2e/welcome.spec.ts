import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

const fresh = async (page: import("@playwright/test").Page) => {
  await mockBackend(page, "dept_head", {}, false);
  await page.addInitScript(() => {
    // Only the very first load of the test is a fresh device.
    if (!sessionStorage.getItem("zz-fresh")) {
      sessionStorage.setItem("zz-fresh", "1");
      localStorage.removeItem("bizqwik.welcomed");
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
};

test("welcome: a first-time visitor sees it, Get Started goes to signup", async ({ page }) => {
  await fresh(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByText("Welcome to Bizqwik!")).toBeVisible();
  await expect(page.getByText("Easily manage your coaching operations, bookings, revenue, reward your clients and more.")).toBeVisible();
  await page.getByRole("button", { name: "Get Started" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.screenshot({ path: "test-results/welcome-after.png" });
});

test("welcome: Login goes to the normal sign-in, and the welcome never returns", async ({ page }) => {
  await fresh(page);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  // Seen once: signed out later (or visiting again) is the plain sign-in page.
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/login$/);
});

test("welcome: a signed-out user who has used the app before gets the regular sign-in", async ({ page }) => {
  await mockBackend(page, "dept_head", {}, false);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("welcome: fits a phone and shows the buttons", async ({ page }) => {
  await fresh(page);
  await page.goto("/welcome");
  await expect(page.getByRole("button", { name: "Get Started" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/79d812ed-04bd-5f9f-b39f-4aff3ec4e347/scratchpad/welcome.png" });
});

test("desktop: a first-time visitor skips the phone welcome and gets the split-screen sign-in and sign-up", async ({ page }) => {
  await mockBackend(page, "dept_head", {}, false);
  await page.addInitScript(() => localStorage.removeItem("bizqwik.welcomed"));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await page.goto("/welcome");
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/79d812ed-04bd-5f9f-b39f-4aff3ec4e347/scratchpad/desk-login.png" });
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/79d812ed-04bd-5f9f-b39f-4aff3ec4e347/scratchpad/desk-signup.png" });
});

test("phone: sign-up keeps the single-column layout", async ({ page }) => {
  await mockBackend(page, "dept_head", {}, false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup");
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

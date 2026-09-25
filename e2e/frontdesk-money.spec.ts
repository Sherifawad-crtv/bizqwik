import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// Exercises the real login form + auth redirect (mock reports no profile until
// the token endpoint is hit).
test("login form signs a front-desk user in and lands them in the app", async ({ page }) => {
  await mockBackend(page, "front_desk", {}, /* startSignedIn */ false);
  await page.goto("/login");
  await page.locator('input[type="email"]').fill("zz-fd@zztest.dev");
  await page.locator('input[type="password"]').fill("ZZpass123!");
  await page.locator('button[type="submit"]').click();
  await page.waitForURL("http://localhost:5174/");
  expect(new URL(page.url()).pathname).toBe("/");
});

// Fully-mocked click-through of the front-desk money UI:
// Drop-In -> payment selector -> record a walk-in drop-in.
test("front desk: drop-in with payment selector -> record", async ({ page }) => {
  await mockBackend(page, "front_desk", { "drop-ins": {} });

  await page.goto("/drop-in");
  await page.getByRole("button", { name: "WALK-IN" }).click();
  await expect(page.getByText("One-time entry")).toBeVisible();

  // Payment selector: cash/card offered; wallet hidden for a walk-in (no member).
  await expect(page.getByText("PAYMENT", { exact: true })).toBeVisible();
  await expect(page.getByText("CASH", { exact: true })).toBeVisible();
  await expect(page.getByText("CARD", { exact: true })).toBeVisible();
  await expect(page.getByText("WALLET", { exact: true })).toHaveCount(0);

  // Record a walk-in drop-in.
  await page.getByPlaceholder("e.g. Open gym").fill("Calisthenics");
  await page.locator('input[type="number"]').fill("120");
  await page.getByRole("button", { name: /Confirm drop-in/ }).click();

  await expect(page.getByText(/Drop-in recorded/)).toBeVisible();
  await expect(page.getByText(/Walk-in · Calisthenics · 120 EGP/)).toBeVisible();
});

// Role gating: a front-desk user hitting a dept-head-only route is bounced home.
test("front desk: dept-head-only route is gated", async ({ page }) => {
  await mockBackend(page, "front_desk");
  await page.goto("/classes"); // dept_head only
  await page.waitForURL("http://localhost:5174/"); // RequireRole redirects to "/"
  expect(new URL(page.url()).pathname).toBe("/");
});

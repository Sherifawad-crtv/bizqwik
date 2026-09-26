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
// Drop-In -> walk-in needs a member -> add a new one -> payment -> record.
test("front desk: walk-in must be recorded against a member", async ({ page }) => {
  let sent: Record<string, unknown> | null = null;
  await mockBackend(page, "front_desk", {
    "drop-ins": (body) => {
      sent = body;
      return { body: {} };
    },
  });

  await page.goto("/drop-in");
  await page.getByRole("button", { name: "WALK-IN" }).click();
  await expect(page.getByText("One-time entry")).toBeVisible();

  // No anonymous walk-ins.
  await page.getByPlaceholder("e.g. Open gym").fill("Calisthenics");
  await page.locator('input[type="number"]').fill("120");
  await page.getByRole("button", { name: /Confirm drop-in/ }).click();
  await expect(page.getByText("Link the member or add their details — every walk-in is recorded against a member.")).toBeVisible();
  expect(sent).toBeNull();

  // Add a new member; wallet isn't offered for someone with no wallet yet.
  await page.getByRole("button", { name: "New member" }).click();
  await expect(page.getByText("WALLET", { exact: true })).toHaveCount(0);
  await page.getByLabel("FULL NAME", { exact: true }).fill("Nour Adel");
  await page.getByLabel("PHONE", { exact: true }).fill("0100");
  await page.getByRole("button", { name: /Confirm drop-in/ }).click();
  await expect(page.getByText("Enter the member's email — they sign in to the app with it.")).toBeVisible();
  await page.getByLabel("EMAIL", { exact: true }).fill("Nour@Example.com");
  await page.getByText("CARD", { exact: true }).click();
  await page.getByRole("button", { name: /Confirm drop-in/ }).click();

  await expect(page.getByText(/Drop-in recorded/)).toBeVisible();
  await expect(page.getByText(/Nour Adel \(new member · app invite ready\) · Calisthenics · 120 EGP/)).toBeVisible();
  expect(sent).toMatchObject({ newClient: { name: "Nour Adel", phone: "0100", email: "nour@example.com" }, category: "Calisthenics", price: 120, payMethod: "card" });
});

// Role gating: a front-desk user hitting a dept-head-only route is bounced home.
test("front desk: dept-head-only route is gated", async ({ page }) => {
  await mockBackend(page, "front_desk");
  await page.goto("/classes"); // dept_head only
  await page.waitForURL("http://localhost:5174/"); // RequireRole redirects to "/"
  expect(new URL(page.url()).pathname).toBe("/");
});

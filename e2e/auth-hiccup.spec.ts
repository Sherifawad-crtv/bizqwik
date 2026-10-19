import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// A signed-in person whose first "who am I" fails for a moment (server hiccup,
// phone switching networks) stays signed in — they used to land on sign-in.
for (const fail of ["server error", "no answer"] as const) {
  test(`auth: a ${fail} on launch is retried, not treated as signed out`, async ({ page }) => {
    await mockBackend(page, "dept_head");
    let calls = 0;
    await page.route(/\/functions\/v1\/make-server-980e1cbf\/me$/, (route) => {
      if (route.request().method() === "OPTIONS") return route.fallback();
      calls++;
      // Dev mode launches twice (React StrictMode), so fail both first attempts.
      if (calls > 2) return route.fallback();
      return fail === "server error"
        ? route.fulfill({ status: 500, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: '{"error":"JWT issued at future"}' })
        : route.abort("failed");
    });
    await page.goto("/");
    await expect(page.getByTestId("splash")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toHaveCount(0);
    expect(calls).toBeGreaterThan(2);
  });
}

test("auth: signed out (401) goes straight to sign-in with no retries", async ({ page }) => {
  await mockBackend(page, "dept_head");
  let calls = 0;
  await page.route(/\/functions\/v1\/make-server-980e1cbf\/me$/, (route) => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    calls++;
    return route.fulfill({ status: 401, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: '{"error":"Unauthorized"}' });
  });
  await page.goto("/");
  await expect(page.getByTestId("splash")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /sign in|log in/i }).first()).toBeVisible();
  // Dev mode runs the launch effect twice (React StrictMode): one call each, no retries.
  expect(calls).toBeLessThanOrEqual(2);
});

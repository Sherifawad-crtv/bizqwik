import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

test("launch: the full logo and a spinner show first, then the app", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "dept_head");
  await page.goto("/");
  const splash = page.getByTestId("splash");
  await expect(splash).toBeVisible();
  await expect(splash.getByRole("img", { name: "Bizqwik" })).toHaveAttribute("src", "/wordmark.png");
  await page.screenshot({ path: "/tmp/claude-0/-home-claude-repo/79d812ed-04bd-5f9f-b39f-4aff3ec4e347/scratchpad/splash.png" });
  await expect(splash).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Team", exact: true })).toBeVisible();
});

test("launch: it shows once per launch, not on every screen change", async ({ page }) => {
  await mockBackend(page, "dept_head");
  await page.goto("/");
  await expect(page.getByTestId("splash")).toHaveCount(0);
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page.getByTestId("splash")).toHaveCount(0);
});

import { defineConfig, devices } from "@playwright/test";

// Mocked-network smoke tests for the business/ops app. Every Supabase call
// (auth + edge function) is intercepted in-test, so this runs fully offline
// against the Vite dev server.
//
// Browser: use PLAYWRIGHT_CHROMIUM_PATH if set (e.g. cloud agents), otherwise
// Playwright's bundled Chromium from `npx playwright install chromium`.
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5174",
    trace: "off",
    ...(CHROMIUM ? { launchOptions: { executablePath: CHROMIUM } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], browserName: "chromium" } }],
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

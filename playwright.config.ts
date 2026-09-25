import { defineConfig, devices } from "@playwright/test";

// Mocked-network smoke tests for the business/ops app. Every Supabase call
// (auth + edge function) is intercepted in-test, so this runs fully offline
// against the Vite dev server. Chromium is the pre-installed system build.
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium";

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
    launchOptions: { executablePath: CHROMIUM },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], browserName: "chromium" } }],
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});

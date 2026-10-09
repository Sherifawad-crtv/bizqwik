import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// Each logged session shows when it was recorded, so a head/founder can see who
// scans late. Each line is the source (QR / MANUAL) + the time; backdated
// entries say which day they were added. Logged days read green "Logged".

const now = new Date();
const MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const D1 = `${MONTH}-01`;
const D2 = `${MONTH}-02`;

const ROW = {
  coachId: "prof-zz", name: "Zed Coach", email: "zz@zztest.dev", role: "coach", avatarUrl: null, tierId: null, tierName: null,
  rate: 150, count: 3, groupTotal: 450, privateTotal: 0, packageCount: 0, total: 450, state: "logging", settledAt: null, paidAt: null,
};
const s = (id: string, date: string, source: string, createdAt: string) => ({ id, coachId: "prof-zz", month: MONTH, date, createdBy: "prof-zz", source, createdAt });

test("coach: day cards show when each session was logged", async ({ page }) => {
  await mockBackend(page, "coach", {
    [`month/${MONTH}`]: { rows: [ROW] },
    [`prof-zz/${MONTH}`]: { sessions: [
      s("a", D1, "qr", `${D1}T17:42:00Z`),
      s("b", D1, "manual", `${D1}T18:10:00Z`),
      s("c", D2, "manual", `${MONTH}-09T10:00:00Z`),
    ] },
  });
  await page.goto("/");
  const times = page.getByTestId("session-times");
  await expect(times.first()).toBeVisible();
  const all = (await times.allTextContents()).join(" | ");
  expect(all).toMatch(/QR\s*\d{1,2}:42 [AP]M/);
  expect(all).toMatch(/MANUAL\s*\d{1,2}:10 [AP]M/);
  expect(all).toMatch(/MANUAL\s*Added \w{3} 9/);
  expect(all).not.toMatch(/late|by hand|Scanned/i);
  await expect(page.getByText("LOGGED", { exact: true })).toHaveCount(2); // one per day card, not "LOGGING"
});

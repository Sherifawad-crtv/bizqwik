import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// Each logged session shows when it was recorded, so a head/founder can see who
// scans late. Scans read "Scanned 8:42 PM"; hand entries say so; backdated
// entries say which day they were added.

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
  expect(all).toMatch(/Scanned \d{1,2}:42 [AP]M/);
  expect(all).toMatch(/\d{1,2}:10 [AP]M · by hand/);
  expect(all).toMatch(/Added \w{3} 9 · by hand/);
  expect(all).not.toMatch(/late/i);
});

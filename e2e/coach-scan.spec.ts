import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// Coaches' FAB is a scanner: the coaches'-room QR opens the session stepper
// (locked to today); a member's PT code asks to confirm deducting a session.
// No camera in CI — the scanner accepts a synthetic "bq-test-scan" event.

const now = new Date();
const MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const TODAY = `${MONTH}-${String(now.getDate()).padStart(2, "0")}`;

const ROW = {
  coachId: "prof-zz", name: "Zed Frontdesk", email: "zz-fd@zztest.dev", role: "coach", avatarUrl: null, tierId: null, tierName: null,
  rate: 150, count: 0, groupTotal: 0, privateTotal: 0, packageCount: 0, total: 0, state: "logging", settledAt: null, paidAt: null,
};

// Phone-sized: the FAB is the mobile hero (desktop gets a "Scan QR" button).
test.use({ viewport: { width: 390, height: 844 } });

async function scan(page: Page, token: string) {
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Scan" })).toBeVisible();
  await page.evaluate((t) => window.dispatchEvent(new CustomEvent("bq-test-scan", { detail: t })), token);
}

test("coach: scanning the coaches' QR opens the stepper locked to today", async ({ page }) => {
  const added: Record<string, unknown>[] = [];
  await mockBackend(page, "coach", {
    [`month/${MONTH}`]: { rows: [ROW] },
    [`prof-zz/${MONTH}`]: { sessions: [] },
    scan: (b) => (b?.token === "bqc_room" ? { body: { kind: "attendance", date: TODAY, month: MONTH } } : { status: 400, body: { error: "This QR isn't one of your gym's codes." } }),
    "sessions/add": (b) => {
      added.push(b!);
      return { body: { session: { id: `s${added.length}`, coachId: "prof-zz", month: MONTH, date: TODAY, createdBy: "prof-zz", source: "qr" } } };
    },
  });
  await page.goto("/");
  await scan(page, "bqc_room");
  await expect(page.getByText("Log a session")).toBeVisible();
  await expect(page.getByTestId("scan-date")).toContainText("QR VERIFIED");
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: /Add 2 sessions/ }).click();
  await expect(page.getByText(/Added 2 sessions/)).toBeVisible();
  expect(added).toHaveLength(2);
  expect(added[0]).toMatchObject({ coachId: "prof-zz", month: MONTH, date: TODAY, scanToken: "bqc_room" });
});

test("coach: a bad code explains itself and offers to scan again", async ({ page }) => {
  await mockBackend(page, "coach", {
    [`month/${MONTH}`]: { rows: [ROW] },
    [`prof-zz/${MONTH}`]: { sessions: [] },
    scan: () => ({ status: 400, body: { error: "That's the members' check-in QR — scan the coaches' QR in the coaches' room." } }),
  });
  await page.goto("/");
  await scan(page, "revolt");
  await expect(page.getByRole("alert")).toContainText("members' check-in QR");
  await expect(page.getByRole("button", { name: "Scan again" })).toBeVisible();
});

test("coach: scanning a member's PT code confirms and deducts one session", async ({ page }) => {
  let delivered: Record<string, unknown> | null = null;
  const preview = { id: "pk1", clientName: "Mona Adel", bundleName: "10 PT sessions", sessionsRemaining: 6, sessionsIncluded: 10, expiryDate: "2026-12-01" };
  await mockBackend(page, "coach", {
    [`month/${MONTH}`]: { rows: [ROW] },
    [`prof-zz/${MONTH}`]: { sessions: [] },
    scan: { kind: "pt", package: preview },
    "packages/deliver": (b) => {
      delivered = b;
      return { body: { package: { id: "pk1", sessionsRemaining: 5, sessionsIncluded: 10, status: "active" }, preview: { ...preview, sessionsRemaining: 5 } } };
    },
  });
  await page.goto("/");
  await scan(page, "bqpt_abc");
  await expect(page.getByText("Mona Adel")).toBeVisible();
  await expect(page.getByText("6 → 5")).toBeVisible();
  await page.getByRole("button", { name: "Deduct 1 session" }).click();
  await expect(page.getByText("Session logged · 5 left")).toBeVisible();
  expect(delivered).toEqual({ qrToken: "bqpt_abc" });
});

test("coach: no manual logging — desktop gets Scan QR, the day sheet only removes", async ({ page }) => {
  await mockBackend(page, "coach", {
    [`month/${MONTH}`]: { rows: [{ ...ROW, count: 1, groupTotal: 150, total: 150 }] },
    [`prof-zz/${MONTH}`]: { sessions: [{ id: "s1", coachId: "prof-zz", month: MONTH, date: TODAY, createdBy: "prof-zz", source: "qr" }] },
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "+ Add session" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Scan QR" })).toBeVisible();
  await page.getByText(/1 session/).last().click();
  await expect(page.getByText("QR", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove session" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change date" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add another session/ })).toHaveCount(0);
});

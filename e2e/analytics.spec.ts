import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// Analytics is off without keys (nothing is sent, nothing is loaded), but the app
// still raises its events so what would be sent can be checked here — and so that
// no personal data is in them.
const DESK = { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] };
const events = (page: Page) => page.evaluate(() => (window as any).__bqEvents as { name: string; props: Record<string, unknown> }[]);

test("analytics: off without keys — no analytics requests, and the app is unaffected", async ({ page }) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    if (/posthog|sentry|\/ingest/.test(r.url())) outside.push(r.url());
  });
  await mockBackend(page, "front_desk", { "front-desk/summary": DESK });
  await page.goto("/");
  await expect(page.getByTestId("splash")).toHaveCount(0);
  expect(outside).toEqual([]);
});

test("analytics: who is using it is sent as id, role and gym — never name or email", async ({ page }) => {
  await mockBackend(page, "dept_head");
  await page.goto("/");
  await expect(page.getByTestId("splash")).toHaveCount(0);
  const ev = await events(page);
  const id = ev.find((e) => e.name === "$identify");
  expect(id?.props.role).toBe("dept_head");
  const blob = JSON.stringify(ev);
  expect(blob).not.toContain("zz-fd@zztest.dev");
  expect(blob).not.toMatch(/Zed/);
  // How long the first screen took to be ready.
  const launch = ev.find((e) => e.name === "launch_ready");
  expect(typeof launch?.props.ms).toBe("number");
});

test("analytics: a refused action is recorded by endpoint and reason, without the message or any ids", async ({ page }) => {
  await mockBackend(page, "front_desk", {
    "front-desk/summary": DESK,
    "check-ins": () => ({ status: 409, body: { error: "Maya Hassan was just checked in.", code: "just_checked_in" } }),
    "front-desk/client-status/11111111-2222-3333-4444-555555555555": { client: { id: "x", name: "Maya", phone: null, email: null, age: null, assignedCoachId: null, status: "active", createdAt: "2026-10-01" }, eligible: true },
  });
  await page.goto("/");
  await expect(page.getByTestId("splash")).toHaveCount(0);
  // Fire the same call the check-in screen makes.
  await page.evaluate(async () => {
    const mod = await import("/src/lib/backend.ts");
    await mod.api.checkIn("11111111-2222-3333-4444-555555555555", "manual").catch(() => {});
  });
  const ev = await events(page);
  const err = ev.find((e) => e.name === "api_error" && e.props.path === "check-ins");
  expect(err?.props.code).toBe("just_checked_in");
  expect(err?.props.status).toBe(409);
  const blob = JSON.stringify(ev);
  expect(blob).not.toContain("Maya");
  expect(blob).not.toContain("11111111-2222");
});

import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";
import { parseImport, toIsoDate } from "../src/lib/importParse";

test("import parser: tab or comma, any column order, day-first dates", () => {
  const tsv = "Phone\tName\tExpiry\tSessions left\n010 1111 2222\tMona Ali\t30/11/2026\t4\n\t\t\t\n01099999999\tOmar\t2026-12-01\t";
  const r = parseImport(tsv);
  expect(r.rows).toEqual([
    { name: "Mona Ali", phone: "010 1111 2222", expiresOn: "2026-11-30", creditsLeft: 4 },
    { name: "Omar", phone: "01099999999", expiresOn: "2026-12-01" },
  ]);
  expect(parseImport("name,expiry\nA,31/02/2026").problems[0].text).toMatch(/isn't a date/);
  expect(parseImport("phone\n01").problems[0].text).toMatch(/column called Name/);
  expect(toIsoDate("5/3/26")).toBe("2026-03-05");
});

test("import: paste a sheet, preview it, import, and see the result", async ({ page }) => {
  let sent: any = null;
  await page.setViewportSize({ width: 390, height: 844 });
  await mockBackend(page, "front_desk", {
    "clients/import": (body: any) => {
      sent = body;
      return { body: { imported: 2, skipped: [{ row: 3, reason: "Already a client (same phone)" }] } };
    },
  });
  await page.goto("/import");
  await page.getByLabel("Paste your members").fill("Name\tPhone\tPlan\tExpiry\nMona Ali\t01012345678\tMonthly\t30/11/2026\nOmar Said\t01099999999\t\t");
  await expect(page.getByText("Ready to import")).toBeVisible();
  await expect(page.getByText("until 2026-11-30")).toBeVisible();
  await page.getByRole("button", { name: "Import 2 members" }).click();
  await expect(page.getByText("members imported")).toBeVisible();
  await expect(page.getByText(/Already a client/)).toBeVisible();
  expect(sent.rows[0]).toMatchObject({ name: "Mona Ali", plan: "Monthly", expiresOn: "2026-11-30" });
});

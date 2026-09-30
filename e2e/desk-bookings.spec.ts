import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

const at = (days: number, h: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

test("front desk: four tabs, and Bookings lists what's booked next with a roster", async ({ page }) => {
  await mockBackend(page, "front_desk", {
    "front-desk/summary": { todayCheckIns: 0, todayDropIns: 0, activeNow: 0, recent: [] },
    classes: {
      classes: [
        { id: "k1", title: "Evening Yoga", description: null, startsAt: at(0, 23), price: 150, status: "active", bookedCount: 3, planSeats: 2, dropInSeats: 1 },
        { id: "k2", title: "Sunrise HIIT", description: null, startsAt: at(1, 7), price: 200, status: "active", bookedCount: 0 },
      ],
    },
    "classes/k1/bookings": {
      bookings: [{ id: "b1", classId: "k1", clientName: "Mona Ali", payMethod: "plan", payStatus: "paid", attendance: "booked", price: 150, coverage: "plan" }],
    },
  });
  await page.goto("/");
  for (const l of ["Desk", "Bookings", "Clients", "Activity"]) await expect(page.getByRole("button", { name: l, exact: true }).or(page.getByRole("link", { name: l, exact: true })).first()).toBeVisible();
  await expect(page.getByLabel("Invitations")).toHaveCount(0);

  await page.getByRole("link", { name: "Bookings", exact: true }).first().click();
  await expect(page.getByText("Evening Yoga")).toBeVisible();
  await expect(page.getByText("3 booked · 1 pay per class")).toBeVisible();
  await expect(page.getByText("Sunrise HIIT")).toHaveCount(0);
  await page.getByRole("button", { name: "Tomorrow" }).click();
  await expect(page.getByText("No one booked")).toBeVisible();

  await page.getByRole("button", { name: "Today" }).click();
  await page.getByText("Evening Yoga").click();
  await expect(page.getByText("Mona Ali")).toBeVisible();
});

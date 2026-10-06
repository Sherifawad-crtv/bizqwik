import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// A 1600×900 landscape PNG, drawn in the page so the test needs no fixture file.
async function landscapePng(page: import("@playwright/test").Page): Promise<Buffer> {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1600;
    c.height = 900;
    const g = c.getContext("2d")!;
    g.fillStyle = "#c33";
    g.fillRect(0, 0, 1600, 900);
    return c.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(b64, "base64");
}

test("dept_head: a class photo is cropped to the 4:5 card and saved with the class", async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  let uploaded: { path: string; width: number; height: number } | null = null;
  await mockBackend(page, "dept_head", {
    revenue: { months: [], totals: { revenue: 0, payouts: 0, profit: 0 }, byService: [], byType: [], byCoach: [], activeSubscribers: { total: 0, groupPlans: 0, ptPackages: 0, byPlanKind: {} }, walletLiability: 0 },
    "class-series": (body) => {
      if (body) posted = body;
      return { body: body ? { series: { id: "s2", ...body, status: "active" } } : { series: [] } };
    },
  });
  await page.route(/\/storage\/v1\/object\/class-images\//, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    const path = new URL(route.request().url()).pathname;
    const buf = route.request().postDataBuffer();
    // Uploads are WebP: the RIFF/WEBP header carries the pixel size.
    let width = 0;
    let height = 0;
    if (buf) {
      const at = buf.indexOf("RIFF");
      if (at >= 0 && buf.toString("ascii", at + 8, at + 12) === "WEBP") {
        const kind = buf.toString("ascii", at + 12, at + 16);
        if (kind === "VP8 ") {
          width = buf.readUInt16LE(at + 26) & 0x3fff;
          height = buf.readUInt16LE(at + 28) & 0x3fff;
        } else if (kind === "VP8X") {
          width = 1 + buf.readUIntLE(at + 24, 3);
          height = 1 + buf.readUIntLE(at + 27, 3);
        } else if (kind === "VP8L") {
          const bits = buf.readUInt32LE(at + 21);
          width = (bits & 0x3fff) + 1;
          height = ((bits >> 14) & 0x3fff) + 1;
        }
      }
    }
    uploaded = { path, width, height };
    return route.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" }, body: JSON.stringify({ Key: path }) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/oversight");
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByText("Group class", { exact: true }).click();
  await page.getByPlaceholder("e.g. Sunrise HIIT").fill("Evening Yoga");
  await expect(page.getByText("Members see a Bizqwik photo until you add one", { exact: false })).toBeVisible();

  await page.getByTestId("class-photo-input").setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: await landscapePng(page) });
  await expect(page.getByTestId("class-photo-preview").locator("img")).toBeVisible();
  await expect(page.getByText("Cropped to fit the class card")).toBeVisible();
  expect(uploaded).not.toBeNull();
  // 900 px tall source → a 720×900 crop (4:5), never upscaled.
  expect(uploaded!.path).toContain("/class-images/prof-zz/");
  expect(uploaded!.path).toMatch(/\.webp$/);
  expect(uploaded!.width / uploaded!.height).toBeCloseTo(0.8, 2);
  expect(uploaded!.height).toBe(900);

  await page.getByRole("button", { name: "Mon", exact: true }).click();
  await page.getByPlaceholder("Per class").fill("180");
  await page.getByPlaceholder("1 month").fill("1400");
  await page.getByRole("button", { name: "Create class" }).click();
  await expect(page.getByText("Class created")).toBeVisible();
  expect(String(posted!.imageUrl)).toContain("/storage/v1/object/public/class-images/prof-zz/");
});

// Captures the branded client app's home screen for three illustrative gym brands.
// Lives in the client app repo's e2e/ folder while it runs (it uses that repo's mocks.ts),
// with the fake-class-photos folder copied next to it. Output dir via SHOTS_DIR.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mockBackend, BUNDLE_PLAN } from "./mocks";

const OUT = process.env.SHOTS_DIR!;
const PHOTOS = process.env.PHOTOS_DIR!;
const NINE = new Date(new Date().setHours(9, 0, 0, 0));
const at = (h: number, m = 0) => new Date(new Date(NINE).setHours(h, m)).toISOString();
const cls = (id: string, title: string, startsAt: string, extra: Record<string, unknown> = {}) => ({
  id, seriesId: "s-" + id, title, description: null, startsAt, price: 250, status: "active", booked: false,
  coverage: "drop_in", imageUrl: null, going: { count: 0, initials: [] }, ...extra,
});

const BRANDS = [
  { key: "forge", name: "Forge Athletics", color: "#141414", plan: "10-Class Pack",
    classes: [["Strength Club", 18], ["Hybrid Engine", 19], ["Open Gym", 20]], css: "" },
  { key: "grove", name: "Grove Pilates", color: "#667A33", plan: "Reformer 8-Pack",
    classes: [["Reformer Flow", 18], ["Mat Pilates", 19], ["Stretch & Reset", 20]],
    // olive on beige: the app paints its pages with literal white, so re-tint those surfaces
    css: `:root{--background:#EFE8D8;--card:#F6F1E4;--muted:#E7DFCB;--bq-neutral:#E7DFCB;--bq-secondary:#E7DFCB}
          .bg-white{background-color:#EFE8D8!important}
          [class*="backdrop-blur-xl"]{background:rgba(239,232,216,.55)!important;border-color:rgba(255,255,255,.5)!important}` },
  { key: "ember", name: "Ember Boxing Club", color: "#F2542D", plan: "Boxing Unlimited",
    classes: [["Boxing Fundamentals", 18], ["Pad Work", 19], ["Conditioning", 20]], css: "" },
] as const;

for (const b of BRANDS) {
  test(`home ${b.key}`, async ({ page }) => {
    await page.clock.install({ time: NINE });
    const classes = b.classes.map(([t, h], i) => cls("c" + i, t, at(h as number), i === 0 ? { coverage: "plan", going: { count: 24, initials: ["AK", "MS", "LH", "NR"] } } : { going: { count: 9, initials: ["HB", "OT", "SA"] } }));
    await mockBackend(page, { classes, home: { groupPlan: { ...BUNDLE_PLAN, name: b.plan }, package: null, points: 340, wallet: 1250 } });
    // The app falls back to its default class photos (a Supabase storage host the sandbox can't reach):
    // serve neutral stand-in images; the app itself greys them and tints them with the brand colour.
    await page.route(/app-assets\/classes\/\d+\.jpg/, (r) => {
      const n = (Number(/(\d+)\.jpg/.exec(r.request().url())![1]) % 5) + 1;
      return r.fulfill({ status: 200, contentType: "image/jpeg", headers: { "access-control-allow-origin": "*" }, body: readFileSync(`${PHOTOS}/${n}.jpg`) });
    });
    await page.route(/\/client\/branding/, (r) =>
      r.fulfill({ status: 200, headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
        body: JSON.stringify({ org: { id: "org-revolt", name: b.name, slug: "revolt", status: "trial", mode: "team" },
          branding: { appName: b.name, logoUrl: null, iconUrl: null, primaryColor: b.color, onboardingAssets: [] }, locations: [] }) }));
    await page.setViewportSize({ width: 390, height: 795 });
    await page.goto("/?gym=revolt");
    await page.getByRole("button", { name: "Skip" }).click();
    await page.locator('input[type="email"]').fill("zara@zztest.dev");
    await page.locator('input[type="password"]').fill("ZZpass123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: /Hi, Zara/ })).toBeVisible();
    if (b.css) await page.addStyleTag({ content: b.css });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/client-${b.key}.png` });
  });
}

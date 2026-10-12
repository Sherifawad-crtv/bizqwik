// Renders index.html to Bizqwik-Deck.pdf (16:9, 1920x1080 per page) and per-page PNGs for review.
// Usage: node render.mjs [outDir-for-pngs]
import { chromium } from "/home/user/bizqwik/node_modules/@playwright/test/index.mjs";
import { pathToFileURL } from "node:url";
import { mkdirSync } from "node:fs";

const png = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(pathToFileURL(new URL("./index.html", import.meta.url).pathname).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForLoadState("networkidle");
await page.pdf({ path: "Bizqwik-Deck.pdf", width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true });
if (png) {
  mkdirSync(png, { recursive: true });
  const slides = await page.locator(".slide").all();
  for (let i = 0; i < slides.length; i++) await slides[i].screenshot({ path: `${png}/s${String(i + 1).padStart(2, "0")}.png` });
  // overflow check: any element extending beyond its slide
  const bad = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".slide").forEach((s, i) => {
      const r = s.getBoundingClientRect();
      s.querySelectorAll("*").forEach((el) => {
        const b = el.getBoundingClientRect();
        if (b.width && (b.right > r.right + 1 || b.bottom > r.bottom + 1 || b.left < r.left - 1)) out.push(`slide ${i + 1}: ${el.className || el.tagName}`);
      });
    });
    return out.filter((x) => !/blob/.test(x));
  });
  console.log("overflow:", bad.length ? bad.slice(0, 20) : "none");
}
await browser.close();
console.log("done");

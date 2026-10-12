// Renders index.html -> Bizqwik-Deck.pdf (16:9, 15 pages).
// Each slide is captured at 2x and placed full-bleed on its own PDF page, so soft shadows and
// device frames look identical in every viewer (Preview, Acrobat, browsers).
// Usage: node render.mjs [dirForPagePngs]
import { chromium } from "/home/user/bizqwik/node_modules/@playwright/test/index.mjs";
import { pathToFileURL } from "node:url";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const pngDir = resolve(process.argv[2] || `${here}.pages`);
mkdirSync(pngDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(`${here}index.html`).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForLoadState("networkidle");

const slides = await page.locator(".slide").all();
for (let i = 0; i < slides.length; i++) await slides[i].screenshot({ path: `${pngDir}/s${String(i + 1).padStart(2, "0")}.png` });

const bad = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll(".slide").forEach((s, i) => {
    const r = s.getBoundingClientRect();
    s.querySelectorAll("*").forEach((el) => {
      if (el.closest(".dev") || el.classList.contains("blob")) return;
      const b = el.getBoundingClientRect();
      if (b.width && (b.right > r.right + 1 || b.bottom > r.bottom + 1 || b.left < r.left - 1)) out.push(`slide ${i + 1}: ${el.className || el.tagName}`);
    });
  });
  return out;
});
console.log("overflow:", bad.length ? bad.slice(0, 20) : "none");

const html = `<!doctype html><style>@page{size:1920px 1080px;margin:0}*{margin:0}body{background:#F3F2EE}img{display:block;width:1920px;height:1080px;page-break-after:always}</style>` +
  slides.map((_, i) => `<img src="file://${pngDir}/s${String(i + 1).padStart(2, "0")}.png">`).join("");
writeFileSync(`${pngDir}/pdf.html`, html);
const pdfPage = await browser.newPage();
await pdfPage.goto(pathToFileURL(`${pngDir}/pdf.html`).href);
await pdfPage.pdf({ path: `${here}Bizqwik-Deck.pdf`, width: "1920px", height: "1080px", printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log("done");

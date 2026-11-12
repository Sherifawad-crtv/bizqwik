// Fails when the first download grows past its budget. Run after `npm run build`:
//   npm run size
// "First download" = the entry script plus the shared scripts it needs up front.
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

// Every tab screen ships up front on purpose (a tab tap must never wait on a
// download), so this is a ceiling on growth, not a target.
const BUDGET_KB = 300; // gzip, entry + shared chunks the page loads before the first screen
const dir = "dist/assets";
const html = readFileSync("dist/index.html", "utf8");
const first = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((m) => m[1]);
let total = 0;
for (const f of first) {
  const kb = gzipSync(readFileSync(`${dir}/${f}`)).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} kB  ${f}`);
}
console.log(`${total.toFixed(1).padStart(7)} kB  total first download (budget ${BUDGET_KB})`);
if (total > BUDGET_KB) {
  console.error("Over budget: something heavy was added to the first download. Load it on demand instead.");
  process.exit(1);
}
void readdirSync;

// Fails when any transition or animation in the app is longer than 350ms, or
// is typed by hand instead of using the motion scale (src/design-system/motion/motion.ts and the
// --dur-* tokens). Loops (spinners, skeleton pulses) are not motions. Run with:
//   npm run motion
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX = 350;
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(tsx?|css)$/.test(f) && files.push(p); });
walk("src");

const problems = [];
for (const f of files) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (!/transition|animation/i.test(line) || /infinite/.test(line) || /prefers-reduced-motion|0\.01ms/.test(line)) return;
    for (const m of line.matchAll(/(?<![\w$.-])(\d*\.?\d+)(ms|s)\b/g)) {
      const ms = m[2] === "s" ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
      if (ms === 0) continue;
      if (ms > MAX) problems.push(`${f}:${i + 1}  ${ms}ms is over ${MAX}ms`);
      else problems.push(`${f}:${i + 1}  ${m[0]} typed by hand (use the motion scale)`);
    }
  });
}
// The duration tokens (the motion scale itself) must stay within the limit too.
const tokens = JSON.parse(readFileSync("src/design-system/tokens/tokens.json", "utf8"));
for (const [name, t] of Object.entries(tokens.duration)) {
  if (name.startsWith("$") || name === "success-hold") continue; // a hold, not a motion
  const ms = parseFloat(t.$value) * (t.$value.endsWith("ms") ? 1 : 1000);
  if (ms > MAX) problems.push(`tokens.json  duration.${name} = ${ms}ms is over ${MAX}ms`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`motion: every transition and animation uses the scale and is ≤ ${MAX}ms`);

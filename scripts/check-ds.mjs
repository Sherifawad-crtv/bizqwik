// Keeps the design system honest. Run: npm run ds   (part of npm run check)
//
// 1. Every component in the library (src/design-system/components/) and in
//    the shared business components (src/shared/components/) must be listed in
//    DESIGN_SYSTEM.md, so a new component is always added to the directory.
// 2. Screens must not re-define library components (a local Card, Chip, Tag…).
// 3. Import boundaries: features use design-system and shared, never another
//    feature or the app frame; shared never reaches into features or app; the
//    design system never reaches into features, app or shared components.
// 4. Hand-built versions of things the library covers (an inline card, a row
//    divider, a tag, a status pill, a styled <button>, a big number, a raw hex
//    colour) may not increase. The leftovers from before the library are
//    counted in scripts/ds-baseline.json; the count can only go down. After
//    moving more screens onto the library, lower it with: npm run ds -- --update
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, out) : /\.tsx?$/.test(f) && out.push(p); } return out; };
const files = walk("src").filter((f) => !f.startsWith("src/design-system/tokens/")); // generated token files hold the raw values on purpose
const read = (f) => readFileSync(f, "utf8");
const errors = [];

// 1. directory completeness
const doc = read("DESIGN_SYSTEM.md");
const LIB_DIRS = ["src/design-system/components", "src/shared/components"];
for (const f of LIB_DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".tsx")).map((f) => join(d, f)))) {
  for (const m of read(f).matchAll(/export function ([A-Z]\w*)/g)) {
    if (!new RegExp("`" + m[1] + "`").test(doc)) errors.push(`${f}: component ${m[1]} is not listed in DESIGN_SYSTEM.md (add it to the directory)`);
  }
}

// 2. no local copies of library components outside the library
const LIB = ["Card", "SectionCard", "ListRow", "SectionHeader", "SectionTitle", "Chip", "ChipGroup", "Tag", "StatusBadge", "IconButton", "ErrorBanner", "Button", "Sheet", "EmptyState"];
for (const f of files.filter((f) => !LIB_DIRS.some((d) => f.startsWith(d)))) {
  for (const m of read(f).matchAll(/(?:^|\n)\s*(?:export )?function ([A-Z]\w*)\b/g)) {
    if (LIB.includes(m[1])) errors.push(`${f}: defines its own ${m[1]}; use the one in src/design-system/components (see DESIGN_SYSTEM.md)`);
  }
}

// 3. import boundaries
const area = (p) => {
  const m = /^src\/(app|design-system|shared|features)\/?([^/]*)/.exec(p);
  if (!m) return { top: "root" };
  return { top: m[1], sub: m[2], comp: m[1] === "shared" && m[2] === "components" };
};
for (const f of files) {
  const from = area(f);
  for (const m of read(f).matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    const to = area(join(f, "..", m[1]).replace(/\\/g, "/"));
    let bad = null;
    if (from.top === "features" && (to.top === "app" || (to.top === "features" && to.sub !== from.sub))) bad = "a feature may only use design-system, shared and its own folder";
    if (from.top === "shared" && (to.top === "features" || to.top === "app")) bad = "shared code may not use features or the app frame";
    if (from.top === "design-system" && (to.top === "features" || to.top === "app" || to.comp)) bad = "the design system may not use features, the app frame or shared components";
    if (bad) errors.push(`${f}: imports ${m[1]} (${bad})`);
  }
}

// 4. hand-built patterns (ratchet)
const styleBlocks = (t) => [...t.matchAll(/style=\{\{([\s\S]*?)\}\}/g)].map((m) => m[1]);
const RULES = {
  "inline card (use Card / cardClass)": (t) => styleBlocks(t).filter((s) => s.includes('background: "var(--color-bg-surface-primary-default)"') && s.includes("var(--radius-card)")).length,
  "inline row divider (use ListRow / listRowClass)": (t) => styleBlocks(t).filter((s) => /borderBottom: [^,]*1px solid var\(--color-border-primary-default\)/.test(s)).length,
  "inline tag (use Tag)": (t) => (t.match(/font: "700 10px var\(--font-family-mono\)"/g) || []).length,
  "inline status pill (use StatusBadge)": (t) => styleBlocks(t).filter((s) => s.includes("borderRadius: 999") && s.includes('padding: "4px 10px"')).length,
  "hand-styled <button> (use Button / IconButton / Chip / ListRow)": (t) => (t.match(/<button\b[^>]*?style=\{\{[^}]*borderRadius/g) || []).length,
  "inline big number (use bq-stat-*)": (t) => (t.match(/font: "800 /g) || []).length,
  "raw hex colour (use a colour token)": (t) => (t.match(/["'`]#[0-9a-fA-F]{3,8}\b/g) || []).length,
};
const LIBRARY_FILES = new Set(["Card", "ListRow", "Tag", "IconButton", "Chip"].map((c) => `src/design-system/components/${c}.tsx`));
const counts = {}; const where = {};
for (const [rule, fn] of Object.entries(RULES)) {
  counts[rule] = 0; where[rule] = [];
  for (const f of files) {
    if (LIBRARY_FILES.has(f)) continue;
    const n = fn(read(f));
    if (n) { counts[rule] += n; where[rule].push(`${relative(".", f)} (${n})`); }
  }
}
const BASE = "scripts/ds-baseline.json";
if (process.argv.includes("--update") || !existsSync(BASE)) {
  writeFileSync(BASE, JSON.stringify(counts, null, 2) + "\n");
  console.log("ds: baseline written", counts);
} else {
  const base = JSON.parse(read(BASE));
  for (const [rule, n] of Object.entries(counts)) {
    const allowed = base[rule] ?? 0;
    if (n > allowed) errors.push(`${rule}: ${n} now, ${allowed} allowed. New hand-built UI found; use the library. Files:\n    ${where[rule].join("\n    ")}`);
    else if (n < allowed) console.log(`ds: ${rule} went down ${allowed} → ${n}; lower the baseline with npm run ds -- --update`);
  }
}
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("ds: library directory complete, no local copies, no new hand-built UI");

// Keeps the design system honest. Run: npm run ds   (part of npm run check)
//
// 1. Every component in the library (src/design-system/components/) and in
//    the shared business components (src/shared/components/, src/shared/classes/) must be listed in
//    DESIGN_SYSTEM.md, so a new component is always added to the directory.
// 2. Screens must not re-define library components (a local Card, Chip, Tag…).
// 3. Import boundaries: features use design-system and shared, never another
//    feature or the app frame; shared never reaches into features or app; the
//    design system never reaches into features, app or shared/.
//    Inside a feature, the layers keep their direction (see 3b below); from
//    outside, a feature is used only through its index.ts or routes/ (3c).
// 4. Hand-built versions of things the library covers (a row divider, a styled
//    <button>, a big number) and values a token should cover (raw colours, font
//    sizes, corner radii, off-scale spacing) and static inline styles may not
//    increase, in TSX or CSS. The leftovers from before the library are
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
const LIB_DIRS = ["src/design-system/components", "src/shared/components", "src/shared/classes"];
for (const f of LIB_DIRS.flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".tsx")).map((f) => join(d, f)))) {
  for (const m of read(f).matchAll(/export function ([A-Z]\w*)/g)) {
    if (!new RegExp("`" + m[1] + "`").test(doc)) errors.push(`${f}: component ${m[1]} is not listed in DESIGN_SYSTEM.md (add it to the directory)`);
  }
}

// 2. no local copies of library components outside the library
const LIB = ["Card", "SectionCard", "ListRow", "SectionHeader", "SectionTitle", "Chip", "ChipGroup", "Tag", "StatusBadge", "IconButton", "ErrorBanner", "Button", "Sheet", "SheetHeading", "EmptyState"];
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
    if (from.top === "design-system" && (to.top === "features" || to.top === "app" || to.top === "shared")) bad = "the design system stands alone: it may not use features, the app frame or shared/";
    if (bad) errors.push(`${f}: imports ${m[1]} (${bad})`);
  }
}

// 3b. layers inside a feature: presentation → domain ← data.
//     domain/ is pure rules: no React, no server calls (type-only imports are fine),
//     nothing from presentation/ or data/. data/ never uses presentation/.
//     Screens reach data/ only through their feature's presentation/hooks/.
const layer = (p) => /^src\/features\/[^/]+\/(data|domain|presentation)\//.exec(p)?.[1] ?? null;
for (const f of files.filter((f) => f.startsWith("src/features/"))) {
  const from = layer(f);
  if (!from) continue;
  const isHook = /\/presentation\/hooks\//.test(f);
  for (const m of read(f).matchAll(/import\s+(type\s+)?[^"';]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']/g)) {
    const typeOnly = !!m[1];
    const spec = m[2] ?? m[3];
    const target = spec.startsWith(".") ? join(f, "..", spec).replace(/\\/g, "/") : spec;
    const to = layer(target);
    let bad = null;
    if (from === "domain" && !typeOnly && (/^react(-dom)?$/.test(spec) || /^src\/shared\/api\//.test(target))) bad = "domain/ holds pure rules: no React and no server calls";
    if (from === "domain" && (to === "presentation" || to === "data")) bad = "domain/ may not use presentation/ or data/";
    if (from === "data" && to === "presentation") bad = "data/ may not use presentation/";
    if (from === "presentation" && !isHook && (to === "data" || (!typeOnly && /^src\/shared\/api\//.test(target)))) bad = "screens reach data/ only through presentation/hooks/";
    if (bad) errors.push(`${f}: imports ${spec} (${bad})`);
  }
}

// 3c. a feature's public entry points: code outside features/<x>/ imports it
//     only through features/<x> (its index.ts) or features/<x>/routes/<Screen>
//     (lazy-loaded screens, one file each so each gets its own chunk).
for (const f of files) {
  for (const m of read(f).matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)) {
    const target = join(f, "..", m[1]).replace(/\\/g, "/");
    const hit = /^src\/features\/([^/]+)(?:\/(.*))?$/.exec(target);
    if (!hit || f.startsWith(`src/features/${hit[1]}/`)) continue;
    const rest = hit[2] ?? "";
    if (rest === "" || rest === "index" || rest === "index.ts" || /^routes\/[^/]+$/.test(rest)) continue;
    errors.push(`${f}: imports ${m[1]} (use features/${hit[1]} — its index.ts — or features/${hit[1]}/routes/*, not a file inside the feature)`);
  }
}

// 4. hand-built patterns (ratchet)
const styleBlocks = (t) => [...t.matchAll(/style=\{\{([\s\S]*?)\}\}/g)].map((m) => m[1]);
// TSX rules (inline styles) and CSS rules (classes). Library CSS that defines
// the pattern itself is exempt; generated tokens are never scanned.
const LIBRARY_CSS = new Set(["Card", "ListRow", "Tag", "IconButton", "Chip", "Button"].map((c) => `src/design-system/components/${c}.css`).concat(["src/design-system/typography.css", "src/design-system/utilities.css", "src/design-system/base.css"]));
const cssRules = (t) => [...t.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => m[2]);
const decl = (body, prop) => [...body.matchAll(new RegExp(`(?:^|;|\\n)\\s*(?:${prop})\\s*:\\s*(?<v>[^;]+)`, "g"))].map((m) => m.groups.v.trim());
const staticInline = (t) => styleBlocks(t).filter((s) => s.split(/,(?![^(]*\))/).every((p) => !p.trim() || /^\s*[a-zA-Z]+\s*:\s*("[^"]*"|-?\d+(\.\d+)?)\s*$/.test(p))).length;
const RULES = {
  // things the library covers
  "row divider typed by hand (use --border-divider or ListRow)": {
    tsx: (t) => styleBlocks(t).filter((s) => /borderBottom: [^,]*1px solid var\(--color-border-primary-default\)/.test(s)).length,
    css: (t) => cssRules(t).filter((b) => /border-bottom:\s*1px solid var\(--color-border-primary-default\)/.test(b)).length,
  },
  "hand-styled <button> (use Button / IconButton / Chip / ListRow)": { tsx: (t) => (t.match(/<button\b[^>]*?style=\{\{[^}]*borderRadius/g) || []).length },
  // Extra-bold (800) text at a raw pixel size: a big number or heading that
  // should be a bq-stat-* or a text style. 800 at a text-style size is fine.
  "big number at an off-scale size (use bq-stat-* or a text style)": {
    tsx: (t) => (t.match(/font: "800 \d+px/g) || []).length,
    css: (t) => cssRules(t).filter((b) => decl(b, "font").some((v) => /^800\s+\d+px/.test(v))).length,
  },
  // tokens
  "raw colour (use a colour token)": {
    tsx: (t) => (t.match(/["'`]#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g) || []).length,
    css: (t) => (t.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g) || []).length,
  },
  "raw font size (use a text style)": {
    tsx: (t) => (t.match(/(font|fontSize):\s*"[^"]*\b\d+px/g) || []).length,
    css: (t) => cssRules(t).filter((b) => [...decl(b, "font"), ...decl(b, "font-size")].some((v) => /\b\d+px/.test(v))).length,
  },
  "raw corner radius (use a radius token)": {
    tsx: (t) => (t.match(/borderRadius:\s*("\d+px"|[1-9]\d*)/g) || []).length,
    css: (t) => cssRules(t).filter((b) => decl(b, "border(?:-[a-z]+)*-radius").some((v) => /\b[1-9]\d*px/.test(v))).length,
  },
  "off-scale spacing (use --space-*)": {
    css: (t) => cssRules(t).filter((b) => decl(b, "(?:padding|margin|gap)(?:-[a-z]+)?").some((v) => /\b(?!(?:4|8|12|16|20|24|32)px)\d+px/.test(v))).length,
  },
  "static inline style (use a class)": { tsx: staticInline },
};
const LIBRARY_FILES = new Set(["Card", "ListRow", "Tag", "IconButton", "Chip"].map((c) => `src/design-system/components/${c}.tsx`));
const cssFiles = (function walkCss(d, out = []) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walkCss(p, out) : f.endsWith(".css") && out.push(p); } return out; })("src").filter((f) => !f.startsWith("src/design-system/tokens/"));
const counts = {}; const where = {};
for (const [rule, { tsx, css }] of Object.entries(RULES)) {
  counts[rule] = 0; where[rule] = [];
  const scan = (list, fn, skip) => {
    if (!fn) return;
    for (const f of list) {
      if (skip.has(f)) continue;
      const n = fn(read(f));
      if (n) { counts[rule] += n; where[rule].push(`${relative(".", f)} (${n})`); }
    }
  };
  scan(files.filter((f) => f.endsWith(".tsx")), tsx, LIBRARY_FILES);
  scan(cssFiles, css, rule.startsWith("raw") || rule.startsWith("off-scale") ? new Set() : LIBRARY_CSS);
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

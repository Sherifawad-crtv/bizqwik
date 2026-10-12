// Renders the Solar icons used in the deck to inline SVG strings -> icons.json
// (same @solar-icons/react set the Bizqwik apps use). Run from the repo root: node deck/gen-icons.mjs
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
const base = "/home/user/bizqwik/node_modules/@solar-icons/react/dist/icons";
const want = ["chart-square", "calculator", "qr-code", "users-group-two-rounded", "smartphone", "check-circle", "smartphone-update", "stars", "cpu-bolt", "buildings", "map-point-add", "user-plus", "chat-round-dots", "add-circle", "alt-arrow-right", "arrow-right", "star"];
const out = {};
for (const w of ["linear", "bold-duotone"]) {
  for (const n of want) {
    const mod = await import(`${base}/${w}/${n}.mjs`);
    const C = Object.values(mod).find((v) => typeof v === "function" || typeof v === "object");
    out[`${w}/${n}`] = renderToStaticMarkup(createElement(C, { size: 24, color: "currentColor" }));
  }
}
writeFileSync("deck/icons.json", JSON.stringify(out));
console.log(Object.keys(out).length, "icons; sample:", out["linear/qr-code"].slice(0, 200));

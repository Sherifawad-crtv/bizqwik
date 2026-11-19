// Brand theme: recolours the whole app from one hex.
//
// Every semantic colour (buttons, active states, tints, brand text…) points at
// the `primitive-color-brand-*` tokens, so replacing those few variables on
// :root is enough. Calling setBrandColor(null) goes back to Bizqwik violet,
// exactly as defined in tokens.json.
//
// Not wired to data yet: the staff app doesn't receive the gym's brand colour
// from the server today.

const VARS = ["300", "400", "500", "600", "700", "800", "alpha-10", "alpha-12", "alpha-16", "alpha-28", "alpha-40"].map((s) => `--primitive-color-brand-${s}`);

type RGB = [number, number, number];

function parseHex(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = ([r, g, b]: RGB) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

/** The brand scale derived from one base colour (the 500 step). */
export function brandScale(hex: string): Record<string, string> | null {
  const base = parseHex(hex);
  if (!base) return null;
  const rgba = (a: number) => `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${a})`;
  return {
    "--primitive-color-brand-300": toHex(mix(base, WHITE, 0.45)),
    "--primitive-color-brand-400": toHex(mix(base, WHITE, 0.15)),
    "--primitive-color-brand-500": toHex(base),
    "--primitive-color-brand-600": toHex(mix(base, BLACK, 0.18)),
    "--primitive-color-brand-700": toHex(mix(base, BLACK, 0.12)),
    "--primitive-color-brand-800": toHex(mix(base, BLACK, 0.45)),
    "--primitive-color-brand-alpha-10": rgba(0.1),
    "--primitive-color-brand-alpha-12": rgba(0.12),
    "--primitive-color-brand-alpha-16": rgba(0.16),
    "--primitive-color-brand-alpha-28": rgba(0.28),
    "--primitive-color-brand-alpha-40": rgba(0.4),
  };
}

/** Apply a gym's brand colour to the whole app, or `null` for the default. */
export function setBrandColor(hex: string | null, root: HTMLElement = document.documentElement): void {
  const scale = hex ? brandScale(hex) : null;
  for (const v of VARS) {
    if (scale) root.style.setProperty(v, scale[v]);
    else root.style.removeProperty(v);
  }
}

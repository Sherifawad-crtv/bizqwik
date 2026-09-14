// Matches the curvature of the native `corner-shape: superellipse(6)` used
// on Chromium (see index.css) — WebKit (Safari, iOS + macOS) and Firefox
// don't implement `corner-shape` at all, so [data-sq] elements there fall
// back to plain rounded corners. This clips the same elements to an
// equivalent curve in JS, driven off each element's own `border-radius`
// and measured size.
//
// The underlying curve is a superellipse |x/r|^n + |y/r|^n = 1 — the
// `superellipse(N)` CSS function's argument is directly that exponent N
// (confirmed empirically: superellipse(2) renders as a plain circular
// corner, matching n=2). Must stay equal to the exponent used in index.css.
const SUPERELLIPSE_N = 6;
const STEPS_PER_CORNER = 14;

function superellipsePoint(cx: number, cy: number, r: number, theta: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const x = cx + r * Math.sign(c) * Math.abs(c) ** (2 / SUPERELLIPSE_N);
  const y = cy + r * Math.sign(s) * Math.abs(s) ** (2 / SUPERELLIPSE_N);
  return [x, y];
}

function cornerArc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= STEPS_PER_CORNER; i++) {
    const deg = fromDeg + ((toDeg - fromDeg) * i) / STEPS_PER_CORNER;
    pts.push(superellipsePoint(cx, cy, r, (deg * Math.PI) / 180));
  }
  return pts;
}

// The curve is already piecewise-linear (straight segments between computed
// superellipse points, no bezier/arc commands) — so it's expressed as a
// `polygon()` clip-path, not `path()`. `path()` needs Safari 16.4+ and drops
// silently (falling back to plain border-radius corners) on anything older;
// `polygon()` has been supported since Safari 9.1, so it actually renders
// everywhere the rest of this app needs to run.
function squirclePolygon(width: number, height: number, r: number): string {
  const points = [
    ...cornerArc(width - r, r, r, -90, 0), // top-right
    ...cornerArc(width - r, height - r, r, 0, 90), // bottom-right
    ...cornerArc(r, height - r, r, 90, 180), // bottom-left
    ...cornerArc(r, r, r, 180, 270), // top-left
  ];
  const round = (n: number) => Math.round(n * 100) / 100;
  return points.map(([x, y]) => `${round(x)}px ${round(y)}px`).join(", ");
}

function nativeSquircleSupported(): boolean {
  return typeof CSS !== "undefined" && !!CSS.supports && CSS.supports("corner-shape", `superellipse(${SUPERELLIPSE_N})`);
}

function applyTo(el: HTMLElement) {
  const width = el.offsetWidth;
  const height = el.offsetHeight;
  if (width < 1 || height < 1) return;

  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const cornerRadius = Math.min(radius, width / 2, height / 2);
  if (cornerRadius <= 0) {
    el.style.clipPath = "";
    return;
  }

  el.style.clipPath = `polygon(${squirclePolygon(width, height, cornerRadius)})`;
}

const tracked = new Set<HTMLElement>();
const resizeObserver =
  typeof ResizeObserver !== "undefined"
    ? new ResizeObserver((entries) => {
        for (const entry of entries) applyTo(entry.target as HTMLElement);
      })
    : null;

function track(el: HTMLElement) {
  if (tracked.has(el)) return;
  tracked.add(el);
  applyTo(el);
  resizeObserver?.observe(el);
}

function untrack(el: HTMLElement) {
  if (!tracked.delete(el)) return;
  resizeObserver?.unobserve(el);
}

function sweep(root: Element) {
  if (root.hasAttribute("data-sq")) track(root as HTMLElement);
  root.querySelectorAll("[data-sq]").forEach((el) => track(el as HTMLElement));
}

function unsweep(root: Element) {
  if (root.hasAttribute("data-sq")) untrack(root as HTMLElement);
  root.querySelectorAll("[data-sq]").forEach((el) => untrack(el as HTMLElement));
}

let started = false;

export function initSquirclePolyfill() {
  if (started || typeof document === "undefined" || nativeSquircleSupported()) return;
  started = true;

  sweep(document.body);

  const mutationObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => node instanceof Element && sweep(node));
      m.removedNodes.forEach((node) => node instanceof Element && unsweep(node));
    }
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

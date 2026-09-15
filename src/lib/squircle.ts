// Matches the curvature of the native `corner-shape: squircle` used on
// Chromium — WebKit (Safari, iOS + macOS) and Firefox don't implement that
// property at all, so [data-sq] elements there fall back to plain rounded
// corners. This clips the same elements to an equivalent curve in JS,
// driven off each element's own `border-radius` and measured size.
//
// The CSS spec defines `squircle` as `superellipse(2)` — a curve of
// |x/r|^n + |y/r|^n = 1 with n = 2*2 = 4, swapped in for the plain
// circular arc (n = 2) a normal border-radius corner uses. That's the
// exact math below, not an approximation, so it matches Chromium's
// rendering rather than some other "squircle-ish" curve family.
const SUPERELLIPSE_N = 4;
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

function squirclePath(width: number, height: number, r: number): string {
  const points = [
    ...cornerArc(width - r, r, r, -90, 0), // top-right
    ...cornerArc(width - r, height - r, r, 0, 90), // bottom-right
    ...cornerArc(r, height - r, r, 90, 180), // bottom-left
    ...cornerArc(r, r, r, 180, 270), // top-left
  ];
  const round = (n: number) => Math.round(n * 100) / 100;
  const [first, ...rest] = points;
  return [`M${round(first[0])} ${round(first[1])}`, ...rest.map(([x, y]) => `L${round(x)} ${round(y)}`), "Z"].join(" ");
}

function nativeSquircleSupported(): boolean {
  return typeof CSS !== "undefined" && !!CSS.supports && CSS.supports("corner-shape", "squircle");
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

  el.style.clipPath = `path('${squirclePath(width, height, cornerRadius)}')`;
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

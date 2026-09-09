import { getSvgPath } from "figma-squircle";

// Matches the curvature of the native `corner-shape: squircle` used on
// Chromium — WebKit (Safari, iOS + macOS) and Firefox don't implement that
// property at all, so [data-sq] elements there fall back to plain rounded
// corners. This clips the same elements to an equivalent superellipse path
// in JS, driven off each element's own `border-radius` and measured size.
// 1 = maximum curvature. At the radius-to-size ratios used across this UI
// (16-28px radii on much larger boxes), anything lower reads as visually
// identical to a plain border-radius.
const CORNER_SMOOTHING = 1;

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

  const path = getSvgPath({ width, height, cornerRadius, cornerSmoothing: CORNER_SMOOTHING });
  el.style.clipPath = `path('${path}')`;
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

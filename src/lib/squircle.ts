import { getSvgPath } from "figma-squircle";

// Real iOS/Figma-style continuous-curvature corners for every [data-sq]
// element, driven off each element's own `border-radius` and measured
// size. No CSS `corner-shape` fast path here — Chromium's native property
// only supports a plain superellipse exponent, not Figma's G2-continuous
// smoothing spline, so it can't reproduce this curve; clip-path is applied
// uniformly in JS on every browser instead, guaranteeing every browser
// renders pixel-identically.
//
// cornerSmoothing: 0.6 is the value Figma (and most "iOS-style squircle"
// implementations) use to replicate the native iOS look.
const CORNER_SMOOTHING = 0.6;

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
  if (started || typeof document === "undefined") return;
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

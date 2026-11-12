// What the app feels like on a real phone: how long a tap waits before the app
// even starts reacting (input delay), the slowest interaction, how long the
// biggest piece of the first screen took, how much the layout jumped, and how
// long each screen took to be ready. Measured with the browser's own observers
// (no library), sent once when the person leaves the app, through the same
// privacy rules as every other event: numbers only, no names, no page content.
import { track, cleanPath } from "./analytics";

interface TimingEntry extends PerformanceEntry {
  processingStart?: number;
  interactionId?: number;
  hadRecentInput?: boolean;
  value?: number;
}

let started = false;
let lcp = 0;
let cls = 0;
let longTasks = 0;
let longTaskMs = 0;
let worstInteraction = 0;
let worstDelay = 0;
let interactions = 0;
let delaySum = 0;
let sent = false;

function observe(type: string, cb: (e: TimingEntry) => void, extra: Record<string, unknown> = {}) {
  try {
    const po = new PerformanceObserver((list) => list.getEntries().forEach((e) => cb(e as TimingEntry)));
    po.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
  } catch {
    // this browser doesn't offer that measurement; skip it
  }
}

function conn() {
  const n = navigator as Navigator & { connection?: { effectiveType?: string }; deviceMemory?: number };
  return { net: n.connection?.effectiveType ?? null, mem: n.deviceMemory ?? null, cores: navigator.hardwareConcurrency ?? null };
}

function flush() {
  if (sent) return;
  sent = true;
  track("web_vitals", {
    lcp_ms: Math.round(lcp),
    cls: Math.round(cls * 1000) / 1000,
    inp_ms: Math.round(worstInteraction),
    input_delay_max_ms: Math.round(worstDelay),
    input_delay_avg_ms: interactions ? Math.round(delaySum / interactions) : 0,
    interactions,
    long_tasks: longTasks,
    long_task_ms: Math.round(longTaskMs),
    ...conn(),
  });
}

export function startVitals() {
  if (started || typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
  started = true;
  observe("largest-contentful-paint", (e) => (lcp = e.startTime));
  observe("layout-shift", (e) => {
    if (!e.hadRecentInput) cls += e.value ?? 0;
  });
  observe("longtask", (e) => {
    longTasks++;
    longTaskMs += e.duration;
  });
  // Taps, key presses and drags that took 40 ms or more to show a result.
  observe(
    "event",
    (e) => {
      if (!e.interactionId) return;
      interactions++;
      const delay = (e.processingStart ?? e.startTime) - e.startTime;
      delaySum += delay;
      worstDelay = Math.max(worstDelay, delay);
      worstInteraction = Math.max(worstInteraction, e.duration);
    },
    { durationThreshold: 40 },
  );
  // Reported when the person leaves or backgrounds the app (the last reliable moment).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
      sent = false; // the next stretch of use is reported again, from zero
      lcp = cls = longTasks = longTaskMs = worstInteraction = worstDelay = interactions = delaySum = 0;
    }
  });
}

/** How long a screen took from the tap to its data being on screen. */
export function reportScreenReady(path: string, ms: number) {
  track("screen_ready", { path: cleanPath(path), ms: Math.round(ms), ...conn() });
}

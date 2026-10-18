// Product analytics (PostHog) and error reporting (Sentry).
//
// Off until keys are set: with no VITE_POSTHOG_KEY / VITE_SENTRY_DSN nothing is
// downloaded, nothing is sent, and every function here is a no-op. When on, the
// libraries load after the app has painted (never in the launch path) and send
// through our own domain (/ingest) so ad-blockers don't hide them.
//
// Privacy: no names, emails, phones or notes ever leave the browser. People are
// identified by their id only (plus role and gym); autocapture is off (it records
// button text, which can be a member's name); session replays mask all text and
// all inputs, so they show the flow and the layout, not the people.

declare const __BUILD_ID__: string;

const PH_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

type Prop = string | number | boolean | null | undefined;
type Props = Record<string, Prop>;
type PostHog = typeof import("posthog-js").default;
type SentryLib = typeof import("@sentry/react");

let ph: PostHog | null = null;
let sentry: SentryLib | null = null;
let started = false;
// Things that happen before the libraries have loaded wait here (a short, capped list).
const pending: Array<() => void> = [];
const later = (fn: () => void) => {
  if (pending.length < 100) pending.push(fn);
};

declare global {
  interface Window {
    /** Dev/test only: every event the app raised, so tests can see what would be sent. */
    __bqEvents?: Array<{ name: string; props: Props }>;
  }
}

const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 4000 });
  else window.setTimeout(fn, 2000);
};

/** A request path with ids and the query string removed — safe to send and easy to group. */
export function cleanPath(path: string): string {
  return path.split("?")[0].replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id");
}

export function startAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!import.meta.env.PROD) window.__bqEvents = [];
  if (!PH_KEY && !SENTRY_DSN) return;

  window.addEventListener("error", (e) => reportError(e.error ?? e.message, { source: "window" }));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, { source: "promise" }));

  // After the first screen has appeared, never before.
  window.addEventListener("load", () => idle(load), { once: true });
  if (document.readyState === "complete") idle(load);
}

async function load() {
  const jobs: Promise<void>[] = [];
  if (PH_KEY) {
    jobs.push(
      import("posthog-js").then(({ default: posthog }) => {
        posthog.init(PH_KEY, {
          api_host: "/ingest",
          ui_host: "https://eu.posthog.com",
          person_profiles: "identified_only",
          capture_pageview: "history_change",
          autocapture: false,
          persistence: "localStorage",
          respect_dnt: true,
          session_recording: { maskAllInputs: true, maskTextSelector: "*" },
        });
        ph = posthog;
      }),
    );
  }
  if (SENTRY_DSN) {
    jobs.push(
      import("@sentry/react").then((S) => {
        S.init({
          dsn: SENTRY_DSN,
          environment: import.meta.env.MODE,
          release: typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : undefined,
          tracesSampleRate: 0,
          // Never send the page address's query string or any request body/cookies.
          beforeSend(event) {
            if (event.request) {
              delete event.request.cookies;
              delete event.request.data;
              if (event.request.url) event.request.url = event.request.url.split("?")[0];
              delete event.request.query_string;
            }
            return event;
          },
        });
        sentry = S;
      }),
    );
  }
  await Promise.allSettled(jobs);
  pending.splice(0).forEach((fn) => fn());
}

/** Record that something happened. `props` must be small and free of personal data. */
export function track(name: string, props: Props = {}) {
  if (typeof window === "undefined") return;
  window.__bqEvents?.push({ name, props });
  if (!PH_KEY) return;
  if (ph) ph.capture(name, props);
  else later(() => ph?.capture(name, props));
}

/** Tie what follows to this person (by id), their role, and their gym. */
export function identify(user: { id: string; role: string; orgMode?: string | null; org?: { id: string; name: string; slug: string } | null }) {
  window.__bqEvents?.push({ name: "$identify", props: { role: user.role, org: user.org?.slug ?? null } });
  const run = () => {
    ph?.identify(user.id, { role: user.role, org_mode: user.orgMode ?? null });
    if (user.org) ph?.group("org", user.org.id, { name: user.org.name, slug: user.org.slug });
    sentry?.setUser({ id: user.id });
    sentry?.setTag("role", user.role);
    if (user.org) sentry?.setTag("org", user.org.slug);
  };
  if (ph || sentry) run();
  else if (PH_KEY || SENTRY_DSN) later(run);
}

/** Signed out: stop attributing to that person. */
export function resetAnalytics() {
  ph?.reset();
  sentry?.setUser(null);
}

/** Send a failure to Sentry (only real faults, not expected refusals). */
export function reportError(err: unknown, context: Props = {}) {
  window.__bqEvents?.push({ name: "$error", props: { ...context, message: String((err as Error)?.message ?? err).slice(0, 120) } });
  if (!SENTRY_DSN) return;
  const send = () => sentry?.captureException(err instanceof Error ? err : new Error(String(err)), { extra: context });
  if (sentry) send();
  else later(send);
}

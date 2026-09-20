import { api } from "./backend";

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports as "MacIntel" since iOS 13 — the touch check is what
  // actually distinguishes an iPad from a real Mac.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// iOS/iPadOS only exposes the Push API to a site running as an installed,
// standalone web app (Share → Add to Home Screen) — never in a regular
// Safari tab, on any iOS version. pushSupported() already reflects that
// (Notification/PushManager simply don't exist outside standalone there),
// but callers need this to explain *why* instead of just hiding the toggle.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

// The VAPID public key arrives as a base64url string (what pushManager.subscribe
// actually needs is the raw bytes as a Uint8Array).
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// pushManager.subscribe() requires an ACTIVE worker — register() alone only
// guarantees registration has started, not that it's cleared installing/
// activating, so callers must wait on `.ready` before subscribing.
async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!existing) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

// Module-level cache of the (inherently async) subscription check. Account
// unmounts/remounts every time you navigate away and back, which used to
// mean re-running that check from scratch and re-showing the toggle's
// default state while it resolved — this survives remounts, so a screen
// that mounts after the check has already run once gets the right answer
// on its very first render with nothing left to correct.
let primed: Promise<PushSubscription | null> | null = null;
let cachedOn = false;

function prime(): Promise<PushSubscription | null> {
  if (!primed) {
    primed = currentPushSubscription().then((sub) => {
      cachedOn = !!sub;
      return sub;
    });
  }
  return primed;
}

/** Kicks off (and memoizes) the subscription check — call this as early as
 * possible, e.g. right after login, so cachedPushOn() already has the right
 * answer by the time a toggle needs to render it. */
export function primePushState(): Promise<PushSubscription | null> {
  return prime();
}

export function cachedPushOn(): boolean {
  return cachedOn;
}

/** Re-registers the browser-level subscription (if one exists) with the
 * backend under whichever profile is currently signed in — fired in the
 * background, never awaited by callers. Needed because a push subscription
 * lives at the browser/OS level, scoped to this site, not to which app
 * account is logged in: switching accounts on the same device (e.g. testing
 * as dept_head, then as a coach) otherwise leaves the newly-logged-in
 * profile never actually registered server-side, so it never receives
 * anything. The backend write is a no-op upsert when nothing's changed, so
 * firing it on every mount is cheap. */
export function syncPushSubscriptionInBackground(): void {
  currentPushSubscription().then((sub) => {
    if (sub) void api.pushSubscribe(sub.toJSON()).catch(() => {});
  });
}

/** Asks for notification permission (if not already decided), subscribes
 * this device, and registers the subscription with the backend. Throws with
 * a readable message on denial/failure so the caller can surface it. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error("Push notifications aren't supported on this device.");

  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { publicKey } = await api.pushVapidPublicKey();
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  await api.pushSubscribe(sub.toJSON());
  cachedOn = true;
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) {
    cachedOn = false;
    return;
  }
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await api.pushUnsubscribe(endpoint);
  cachedOn = false;
}

/** Turns push on automatically as soon as it's allowed to — call this once
 * the signed-in user's profile is known (app boot and right after login) —
 * so notifications start flowing without anyone having to find the Account
 * screen toggle. A no-op when unsupported (e.g. iOS outside an installed
 * PWA) or once the browser's permission prompt has already been denied —
 * browsers never re-prompt after a denial, so this never nags, and
 * re-requesting an already-decided permission just resolves instantly with
 * that decision, so it's safe to call on every login. */
export function autoEnablePushIfPossible(): void {
  if (!pushSupported() || Notification.permission === "denied") return;
  prime().then((sub) => {
    if (sub) return;
    enablePush().catch(() => {});
  });
}

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

/** Checks the browser-level subscription and, if one exists, re-registers
 * it with the backend under whichever profile is currently signed in.
 * Needed because a push subscription lives at the browser/OS level, scoped
 * to this site — not to which app account is logged in. Without this,
 * switching accounts on the same device (e.g. testing as dept_head, then as
 * a coach) shows the toggle as already "on" while the newly-logged-in
 * profile was never actually registered server-side, so it never receives
 * anything. Cheap to call on every mount — the backend write is a no-op
 * upsert when nothing's changed. */
export async function syncPushSubscription(): Promise<PushSubscription | null> {
  const sub = await currentPushSubscription();
  if (sub) await api.pushSubscribe(sub.toJSON());
  return sub;
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
}

export async function disablePush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await api.pushUnsubscribe(endpoint);
}

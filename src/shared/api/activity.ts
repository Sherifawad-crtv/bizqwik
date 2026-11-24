import type { ActivityEntry } from "../types";
import { callFn } from "./core";

export const activityApi = {
  // ===== Staff activity feed / logs (dept_head + front_desk) =====
  activity: (limit = 100) => callFn<{ activity: ActivityEntry[] }>(`activity?limit=${limit}`),


  pushVapidPublicKey: () => callFn<{ publicKey: string }>("push/vapid-public-key"),
  pushSubscribe: (sub: PushSubscriptionJSON, deviceId: string) =>
    callFn<void>("push/subscribe", { method: "POST", body: { ...sub, deviceId } as Record<string, unknown>, quiet: true }),
  pushUnsubscribe: (endpoint: string, deviceId: string) => callFn<void>("push/unsubscribe", { method: "POST", body: { endpoint, deviceId }, quiet: true }),
};

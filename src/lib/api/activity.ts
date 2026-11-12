import type { ActivityEntry } from "../types";
import { callFn } from "./core";

export const activityApi = {
  // ===== Staff activity feed / logs (dept_head + front_desk) =====
  activity: (limit = 100) => callFn<{ activity: ActivityEntry[] }>(`activity?limit=${limit}`),

  // Invite an existing client to the branded member app (front_desk / dept_head).
  inviteClient: (clientId: string, email: string) =>
    callFn<{ ok: true }>("client-invites", { method: "POST", body: { clientId, email } }),

  // Money flow (front_desk + dept_head). Refund to wallet (store credit) or "desk"
  // (external money, recorded only); compensation is a dept_head goodwill credit.
  refundClient: (clientId: string, amount: number, destination: "wallet" | "desk", note?: string) =>
    callFn<{ ok: true; walletBalance?: number }>("clients/refund", { method: "POST", body: { clientId, amount, destination, note: note ?? null } }),
  refundable: (clientId: string) => callFn<{ paid: number; refunded: number; refundable: number }>(`clients/refundable/${clientId}`),
  compensateClient: (clientId: string, amount: number, note?: string) =>
    callFn<{ ok: true; walletBalance?: number }>("clients/compensate", { method: "POST", body: { clientId, amount, note: note ?? null } }),

  pushVapidPublicKey: () => callFn<{ publicKey: string }>("push/vapid-public-key"),
  pushSubscribe: (sub: PushSubscriptionJSON, deviceId: string) =>
    callFn<void>("push/subscribe", { method: "POST", body: { ...sub, deviceId } as Record<string, unknown>, quiet: true }),
  pushUnsubscribe: (endpoint: string, deviceId: string) => callFn<void>("push/unsubscribe", { method: "POST", body: { endpoint, deviceId }, quiet: true }),
};

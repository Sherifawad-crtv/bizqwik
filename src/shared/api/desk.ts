import type { Client, ClientWithPackage, PackageInstance, Role, Rollup, Session, ScanResult, PtScanPreview } from "../types";
import { callFn, SOLO_DESK, CLIENTS_LIST } from "./core";
import type { DropInOption } from "./inputs";

export const deskApi = {
  // The batched client list (one fixed set of queries however many clients);
  // if it's ever unavailable, the original endpoint answers instead.
  clients: async () => {
    try {
      return await callFn<{ clients: ClientWithPackage[] }>("clients", undefined, CLIENTS_LIST);
    } catch (err) {
      console.warn("clients-list unavailable, using the main endpoint", err);
      return callFn<{ clients: ClientWithPackage[] }>("clients");
    }
  },
  // Creation and coach assignment happen atomically, in one call — a client
  // never exists without an assigned coach (no orphaned/unassigned clients).
  createClient: (name: string, age: number | null, conditions: string | null, bundleTypeId: string, coachId: string) =>
    callFn<{ client: Client; package: PackageInstance }>("clients", { method: "POST", body: { name, age, conditions, bundleTypeId, coachId } }),
  // PT sessions are deducted only by scanning the member's per-bundle code.
  deliverSession: (qrToken: string) =>
    callFn<{ package: PackageInstance; preview: PtScanPreview }>("packages/deliver", { method: "POST", body: { qrToken } }),
  // The FAB scanner: what did the coach just scan?
  scan: (token: string) => callFn<ScanResult>("scan", { method: "POST", body: { token } }),

  createInvite: (email: string, role: Role, tierId: string | null) =>
    callFn<void>("invites", { method: "POST", body: { email, role, tierId } }),

  month: (month: string) => callFn<{ rows: Rollup[] }>(`month/${month}`),
  addSession: (coachId: string, month: string, date: string, scanToken?: string) =>
    callFn<{ session: Session }>("sessions/add", { method: "POST", body: { coachId, month, date, scanToken } }),
  editSession: (id: string, coachId: string, month: string, date: string) =>
    callFn<{ session: Session }>("sessions/edit", { method: "POST", body: { id, coachId, month, date } }),
  removeSession: (id: string, coachId: string, month: string) =>
    callFn<void>("sessions/remove", { method: "POST", body: { id, coachId, month } }),

  // A walk-in is always recorded against a member: an existing client, or a
  // new one created with the sale (the backend also registers their app invite).
  orgSettings: async () => {
    const r = await callFn<{ dropInPrice?: number | null; dropInPrices?: Record<string, number | null>; dropInOptions?: Record<string, DropInOption[]>; instapayQr?: string | null; instapayAddress?: string | null }>("org-settings", undefined, SOLO_DESK);
    return { dropInPrice: r.dropInPrice ?? null, dropInPrices: r.dropInPrices ?? {}, dropInOptions: r.dropInOptions ?? {}, instapayQr: r.instapayQr ?? null, instapayAddress: r.instapayAddress ?? null };
  },
};

import type { PaymentRequest, Client, ClientWithPackage, CoachOption, FrontDeskSummary, PackageInstance, PayMethod, Role, Rollup, Session, ScanResult, PtScanPreview } from "../types";
import { callFn, SOLO_DESK, CLIENTS_LIST } from "./core";
import type { DropInOption, NewClientFields } from "./inputs";

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
  updateClient: (id: string, name: string, age: number | null, conditions: string | null) =>
    callFn<{ client: Client }>("clients/update", { method: "POST", body: { id, name, age, conditions } }),
  deleteClient: (id: string) => callFn<void>("clients/delete", { method: "POST", body: { id } }),
  sellPackage: (clientId: string, bundleTypeId: string, coachId: string, payMethod?: PayMethod) =>
    callFn<{ package: PackageInstance }>("packages", { method: "POST", body: { clientId, bundleTypeId, coachId, payMethod } }),
  // PT sessions are deducted only by scanning the member's per-bundle code.
  deliverSession: (qrToken: string) =>
    callFn<{ package: PackageInstance; preview: PtScanPreview }>("packages/deliver", { method: "POST", body: { qrToken } }),
  // A solo owner is her own clients' trainer: she logs today's session from the app.
  logPtSession: (packageId: string) =>
    callFn<{ package: PackageInstance; preview: PtScanPreview }>("packages/deliver", { method: "POST", body: { packageId } }),
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

  // Front desk. Coach names only — no payout data, unlike month().
  coaches: () => callFn<{ coaches: CoachOption[] }>("coaches"),
  createServiceClient: (fields: NewClientFields, bundleTypeId: string, coachId: string, payMethod?: PayMethod) =>
    callFn<{ client: Client; package: PackageInstance }>("clients", { method: "POST", body: { ...fields, bundleTypeId, coachId, payMethod } }),
  assignCoach: (id: string, coachId: string) => callFn<{ client: Client }>("clients/assign-coach", { method: "POST", body: { id, coachId } }),
  frontDeskSummary: () => callFn<FrontDeskSummary>("front-desk/summary"),
  // A class bundle loses one session on every check-in (a second scan within a minute is refused as accidental);
  // memberships, class monthlies and PT don't. `plan` is the plan afterwards.
  // `locationId` (where the check-in happens) turns away a plan sold for another location.
  checkIn: (clientId: string, source: "qr" | "manual", locationId?: string | null) =>
    callFn<{ deducted: boolean; plan: { name: string; kind: string; creditsRemaining: number | null; creditsTotal: number | null } | null }>("check-ins", { method: "POST", body: { clientId, source, locationId: locationId ?? undefined } }),
  // A walk-in is always recorded against a member: an existing client, or a
  // new one created with the sale (the backend also registers their app invite).
  orgSettings: async () => {
    const r = await callFn<{ dropInPrice?: number | null; dropInPrices?: Record<string, number | null>; dropInOptions?: Record<string, DropInOption[]>; instapayQr?: string | null; instapayAddress?: string | null }>("org-settings", undefined, SOLO_DESK);
    return { dropInPrice: r.dropInPrice ?? null, dropInPrices: r.dropInPrices ?? {}, dropInOptions: r.dropInOptions ?? {}, instapayQr: r.instapayQr ?? null, instapayAddress: r.instapayAddress ?? null };
  },
  // With `locationId`, sets that location's own drop-in price.
  // Members who paid by InstaPay and uploaded the receipt, waiting for her to approve.
  paymentRequests: () => callFn<{ requests: PaymentRequest[] }>("payment-requests"),
  approvePayment: (id: string) => callFn<{ ok: true }>(`payment-requests/${id}/approve`, { method: "POST" }),
  rejectPayment: (id: string, note?: string) => callFn<{ ok: true }>(`payment-requests/${id}/reject`, { method: "POST", body: { note } }),
  soloDropIn: (payMethod: "cash" | "instapay", locationId?: string | null, label?: string) => callFn<void>("drop-ins", { method: "POST", body: { payMethod, locationId: locationId ?? undefined, label } }, SOLO_DESK),
  dropIn: (member: { clientId: string } | { newClient: NewClientFields }, category: string, price: number, payMethod?: PayMethod, confirmActivePlan = false) =>
    callFn<void>("drop-ins", { method: "POST", body: { ...member, category, price, payMethod, confirmActivePlan } }),
  // A seat in one class session at its drop-in price; lands on the roster.
  classDropIn: (clientId: string, classId: string, payMethod: PayMethod, confirmActivePlan = false) =>
    callFn<void>("drop-ins", { method: "POST", body: { clientId, classId, payMethod, confirmActivePlan } }),
  invite: (clientId: string, inviteeName: string, inviteePhone: string, visitDate: string) =>
    callFn<{ invitationsRemaining: number }>("invitations", { method: "POST", body: { clientId, inviteeName, inviteePhone, visitDate } }),
};

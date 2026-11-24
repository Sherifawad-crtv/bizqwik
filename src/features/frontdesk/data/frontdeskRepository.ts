import { api } from "../../../shared/api/backend";
import { callFn, SOLO_DESK } from "../../../shared/api/core";
import type { NewClientFields, SalePartner } from "../../../shared/api/inputs";
import type { Client, ClientWithPackage, GroupPlan, PackageInstance, PayMethod, PtScanPreview } from "../../../shared/types";
import type { CoachOption, FrontDeskSummary, PaymentRequest } from "../domain/types";

// Data layer: every server call the front desk (and the solo owner's desk)
// makes. Calls only the desk uses live here; lists other features also read
// are wrapped from shared/api.
export const frontdeskRepository = {
  // ---- Shared with other features (wrapped) ----
  bundleTypes: (...a: Parameters<typeof api.bundleTypes>) => api.bundleTypes(...a),
  cancelClass: (...a: Parameters<typeof api.cancelClass>) => api.cancelClass(...a),
  classSeries: (...a: Parameters<typeof api.classSeries>) => api.classSeries(...a),
  classes: (...a: Parameters<typeof api.classes>) => api.classes(...a),
  clients: (...a: Parameters<typeof api.clients>) => api.clients(...a),
  orgSettings: (...a: Parameters<typeof api.orgSettings>) => api.orgSettings(...a),
  paymentsSummary: (...a: Parameters<typeof api.paymentsSummary>) => api.paymentsSummary(...a),
  planTypes: (...a: Parameters<typeof api.planTypes>) => api.planTypes(...a),
  revenue: (...a: Parameters<typeof api.revenue>) => api.revenue(...a),

  // ---- Front desk only ----
  approvePayment: (id: string) => callFn<{ ok: true }>(`payment-requests/${id}/approve`, { method: "POST" }),
  assignCoach: (id: string, coachId: string) => callFn<{ client: Client }>("clients/assign-coach", { method: "POST", body: { id, coachId } }),
  // A class bundle loses one session on every check-in (a second scan within a minute is refused as accidental);
  // memberships, class monthlies and PT don't. `plan` is the plan afterwards.
  // `locationId` (where the check-in happens) turns away a plan sold for another location.
  checkIn: (clientId: string, source: "qr" | "manual", locationId?: string | null) =>
    callFn<{ deducted: boolean; plan: { name: string; kind: string; creditsRemaining: number | null; creditsTotal: number | null } | null }>("check-ins", { method: "POST", body: { clientId, source, locationId: locationId ?? undefined } }),
  // A seat in one class session at its drop-in price; lands on the roster.
  classDropIn: (clientId: string, classId: string, payMethod: PayMethod, confirmActivePlan = false) =>
    callFn<void>("drop-ins", { method: "POST", body: { clientId, classId, payMethod, confirmActivePlan } }),
  clientPlans: (clientId: string) => callFn<{ activePlan: GroupPlan | null; plans: GroupPlan[] }>(`group-plans/client/${clientId}`),
  // Front desk. Coach names only — no payout data, unlike month().
  coaches: () => callFn<{ coaches: CoachOption[] }>("coaches"),
  createServiceClient: (fields: NewClientFields, bundleTypeId: string, coachId: string, payMethod?: PayMethod) =>
    callFn<{ client: Client; package: PackageInstance }>("clients", { method: "POST", body: { ...fields, bundleTypeId, coachId, payMethod } }),
  dropIn: (member: { clientId: string } | { newClient: NewClientFields }, category: string, price: number, payMethod?: PayMethod, confirmActivePlan = false) =>
    callFn<void>("drop-ins", { method: "POST", body: { ...member, category, price, payMethod, confirmActivePlan } }),
  frontDeskSummary: () => callFn<FrontDeskSummary>("front-desk/summary"),
  invite: (clientId: string, inviteeName: string, inviteePhone: string, visitDate: string) =>
    callFn<{ invitationsRemaining: number }>("invitations", { method: "POST", body: { clientId, inviteeName, inviteePhone, visitDate } }),
  // Invite an existing client to the branded member app (front_desk / dept_head).
  inviteClient: (clientId: string, email: string) =>
    callFn<{ ok: true }>("client-invites", { method: "POST", body: { clientId, email } }),
  // A solo owner is her own clients' trainer: she logs today's session from the app.
  logPtSession: (packageId: string) =>
    callFn<{ package: PackageInstance; preview: PtScanPreview }>("packages/deliver", { method: "POST", body: { packageId } }),
  // With `locationId`, sets that location's own drop-in price.
  // Members who paid by InstaPay and uploaded the receipt, waiting for her to approve.
  paymentRequests: () => callFn<{ requests: PaymentRequest[] }>("payment-requests"),
  // Money flow (front_desk + dept_head). Refund to wallet (store credit) or "desk"
  // (external money, recorded only); compensation is a dept_head goodwill credit.
  refundClient: (clientId: string, amount: number, destination: "wallet" | "desk", note?: string) =>
    callFn<{ ok: true; walletBalance?: number }>("clients/refund", { method: "POST", body: { clientId, amount, destination, note: note ?? null } }),
  refundable: (clientId: string) => callFn<{ paid: number; refunded: number; refundable: number }>(`clients/refundable/${clientId}`),
  rejectPayment: (id: string, note?: string) => callFn<{ ok: true }>(`payment-requests/${id}/reject`, { method: "POST", body: { note } }),
  // Front desk: sell a group plan to an existing member or a brand-new one.
  // `offer` is a catalog plan or a class series (that class's monthly).
  // `partners` are the other clients of a shared bundle (existing clients).
  sellGroupPlan: (target: { clientId: string } | NewClientFields, offer: { planTypeId: string } | { seriesId: string }, payMethod: PayMethod, partners?: SalePartner[]) =>
    callFn<{ client: ClientWithPackage; plan: GroupPlan; sharedWith?: { id: string; name: string }[] }>("group-plans/sell", { method: "POST", body: { ...target, ...offer, payMethod, ...(partners?.length ? { partners } : {}) } }),
  sellPackage: (clientId: string, bundleTypeId: string, coachId: string, payMethod?: PayMethod) =>
    callFn<{ package: PackageInstance }>("packages", { method: "POST", body: { clientId, bundleTypeId, coachId, payMethod } }),
  setClientLocation: (id: string, locationId: string | null) => callFn<{ ok: true }>("clients/location", { method: "POST", body: { id, locationId } }),
  soloDropIn: (payMethod: "cash" | "instapay", locationId?: string | null, label?: string) => callFn<void>("drop-ins", { method: "POST", body: { payMethod, locationId: locationId ?? undefined, label } }, SOLO_DESK),
};

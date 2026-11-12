import type { ClassSeries, ClientWithPackage, GroupPlan, GroupPlanType, PayMethod, RevenueReport } from "../types";
import { callFn } from "./core";
import type { SeriesInput, PlanTypeInput, SalePartner, NewClientFields } from "./inputs";

export const servicesApi = {
  // ===== Services: recurring classes, group plan catalog, plan sales, revenue =====
  classSeries: () => callFn<{ series: ClassSeries[] }>("class-series"),
  createClassSeries: (s: SeriesInput) => callFn<{ series: ClassSeries }>("class-series", { method: "POST", body: { ...s } }),
  updateClassSeries: (id: string, s: SeriesInput) =>
    callFn<{ series: ClassSeries; keptBookedSessions: number }>("class-series/update", { method: "POST", body: { id, ...s } }),
  endClassSeries: (id: string) => callFn<{ ok: true; keptBookedSessions: number }>("class-series/end", { method: "POST", body: { id } }),

  planTypes: () => callFn<{ planTypes: GroupPlanType[] }>("plan-types"),
  createPlanType: (p: PlanTypeInput) => callFn<{ planType: GroupPlanType }>("plan-types", { method: "POST", body: { ...p } }),
  updatePlanType: (id: string, p: PlanTypeInput & { active?: boolean }) =>
    callFn<{ planType: GroupPlanType }>("plan-types/update", { method: "POST", body: { id, ...p } }),
  deletePlanType: (id: string) => callFn<{ ok: true }>("plan-types/delete", { method: "POST", body: { id } }),

  // Front desk: sell a group plan to an existing member or a brand-new one.
  // `offer` is a catalog plan or a class series (that class's monthly).
  // `partners` are the other clients of a shared bundle (existing clients).
  sellGroupPlan: (target: { clientId: string } | NewClientFields, offer: { planTypeId: string } | { seriesId: string }, payMethod: PayMethod, partners?: SalePartner[]) =>
    callFn<{ client: ClientWithPackage; plan: GroupPlan; sharedWith?: { id: string; name: string }[] }>("group-plans/sell", { method: "POST", body: { ...target, ...offer, payMethod, ...(partners?.length ? { partners } : {}) } }),
  clientPlans: (clientId: string) => callFn<{ activePlan: GroupPlan | null; plans: GroupPlan[] }>(`group-plans/client/${clientId}`),

  // `history` also returns the month-by-month series for that many months in the same call.
  revenue: (months = 6, history?: number) => callFn<RevenueReport>(`revenue?months=${months}${history ? `&history=${history}` : ""}`),
};

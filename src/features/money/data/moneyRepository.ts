import { api } from "../../../shared/api/backend";

// Data layer: every server call the money feature makes. These endpoints are
// shared with other features, so they stay in shared/api and are wrapped here.
export const moneyRepository = {
  /** Revenue report for the last `months`; `history` asks for a longer month-by-month tail. */
  revenue: (months: number, history?: number) => api.revenue(months, history),
  paymentsSummary: (months: number, locationId: string | null) => api.paymentsSummary(months, locationId),
  /** The latest activity entries, newest first. */
  activity: (limit: number) => api.activity(limit),
  clients: () => api.clients(),
};

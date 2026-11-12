import type { GroupPlanTypeKind } from "../types";

/** One kind of drop-in at a location (e.g. Kids / Adults) and its price. */
export interface DropInOption {
  label: string;
  price: number;
}

export interface SeriesInput {
  title: string;
  description: string | null;
  weekdays: number[];
  startTime: string;
  durationMin: number;
  dropInPrice: number;
  monthlyPrice: number;
  imageUrl: string | null;
  locationId?: string | null;
}

export interface PlanTypeInput {
  kind: GroupPlanTypeKind;
  name: string;
  price: number;
  durationMonths: number;
  credits: number | null;
  invitationsAllowance: number;
  locationId?: string | null;
  sharedSeats?: number | null;
}

/** The other client of a shared bundle: someone already on file, or a new one. */
export type SalePartner = { clientId: string; label?: string } | { name: string; phone: string; email: string };

export interface NewClientFields {
  name: string;
  phone: string | null;
  email: string | null;
}

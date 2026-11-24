// Classes, their bookings and the class series they repeat from.

// ===== Member app: classes (dept_head manages; members book) =====
export type GymClassStatus = "active" | "cancelled";

export interface GymClass {
  id: string;
  seriesId?: string | null;
  title: string;
  description: string | null;
  startsAt: string;
  price: number; // the drop-in price
  status: GymClassStatus;
  // The card photo members see (a series session shows its series' photo).
  imageUrl?: string | null;
  bookedCount?: number;
  // Solo gyms: who said they're coming (names), instead of bookings.
  coming?: string[];
  planSeats?: number;
  dropInSeats?: number;
  locationId?: string | null;
}

export type BookingAttendance = "booked" | "arrived" | "no_show" | "cancelled";
export type BookingPayStatus = "paid" | "pending" | "refunded";

// A class booking as staff see it (roster row): who booked, how they're paying,
// whether they've paid, and their attendance.
export interface ClassBooking {
  id: string;
  classId: string;
  clientName: string | null;
  payMethod: "wallet" | "desk" | "plan";
  payStatus: BookingPayStatus;
  attendance: BookingAttendance;
  price: number;
  // "plan" = paid for by the member's group plan; "drop_in" = paid per class.
  coverage: "plan" | "drop_in";
}

// ===== Services model: recurring classes + group plans =====
// A class series repeats on the chosen weekdays at one local time, month to
// month, until someone edits or ends it. Each session is bookable as a
// drop-in; the monthly price buys a month of that one class.
export interface ClassSeries {
  id: string;
  title: string;
  description: string | null;
  weekdays: number[]; // 0 = Sunday … 6 = Saturday
  startTime: string; // "HH:MM", gym-local
  durationMin: number;
  dropInPrice: number;
  monthlyPrice: number;
  status: "active" | "ended";
  imageUrl?: string | null;
  activeMonthlySubscribers?: number;
  locationId?: string | null;
}

import type { ClassBooking, PayMethod } from "../types";
import { callFn } from "./core";

export const rosterApi = {
  // ===== Class roster / attendance / at-desk collection (dept_head + front_desk) =====
  classBookings: (classId: string) => callFn<{ bookings: ClassBooking[] }>(`classes/${classId}/bookings`),
  markAttendance: (bookingId: string, attendance: "arrived" | "no_show" | "booked") =>
    callFn<{ ok: true }>("bookings/attendance", { method: "POST", body: { bookingId, attendance } }),
  collectBooking: (bookingId: string, payMethod: PayMethod) =>
    callFn<{ ok: true }>("bookings/collect", { method: "POST", body: { bookingId, payMethod } }),
};

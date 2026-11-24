// The data types several features (or shared/ itself) use, one file per topic.
// Import from "shared/types"; this file passes everything through.
export * from "./org";
export * from "./coachPay";
export * from "./clients";
export * from "./plans";
export * from "./classes";
export * from "./money";
// Role rules live in shared/domain/roles.ts; still importable from here.
export { isHead, canLog, hasTier } from "../domain/roles";

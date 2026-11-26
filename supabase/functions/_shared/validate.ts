/** Request body schemas for money/desk POSTs. Uses Zod; never imports make-server. */
import { z } from "npm:zod@3.23.8";
import { errBody } from "./errors.ts";

const Uuid = z.string().uuid();
const UuidOpt = Uuid.optional().nullable();
const PayMethod = z.string().optional();

export const PackageSaleBody = z.object({
  clientId: Uuid,
  bundleTypeId: Uuid,
  coachId: Uuid,
  payMethod: PayMethod,
}).passthrough();

export const CheckInBody = z.object({
  clientId: Uuid,
  source: z.string(),
  locationId: UuidOpt,
}).passthrough();

const NewClient = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
}).passthrough();

export const DropInBody = z.object({
  clientId: Uuid.optional().nullable(),
  newClient: NewClient.optional().nullable(),
  classId: Uuid.optional().nullable(),
  category: z.union([z.string(), z.number()]).optional().nullable(),
  price: z.union([z.string(), z.number()]).optional().nullable(),
  payMethod: PayMethod,
  confirmActivePlan: z.boolean().optional(),
}).passthrough();

const PartnerSpec = z.object({
  clientId: Uuid.optional(),
  name: z.string().optional(),
  age: z.unknown().optional(),
  phone: z.unknown().optional(),
  email: z.unknown().optional(),
}).passthrough();

export const GroupPlanSellBody = z.object({
  clientId: Uuid.optional().nullable(),
  name: z.string().optional(),
  age: z.unknown().optional(),
  phone: z.unknown().optional(),
  email: z.unknown().optional(),
  planTypeId: Uuid.optional().nullable(),
  seriesId: Uuid.optional().nullable(),
  payMethod: PayMethod,
  partners: z.array(PartnerSpec).optional(),
}).passthrough();

export const BookingCollectBody = z.object({
  bookingId: Uuid,
  payMethod: PayMethod,
}).passthrough();

export const ClientRefundBody = z.object({
  clientId: Uuid,
  amount: z.union([z.string(), z.number()]),
  destination: z.string(),
  note: z.union([z.string(), z.null()]).optional(),
}).passthrough();

export const ClientCompensateBody = z.object({
  clientId: Uuid,
  amount: z.union([z.string(), z.number()]),
  note: z.union([z.string(), z.null()]).optional(),
}).passthrough();

type HonoLike = { req: { json: () => Promise<unknown> }; json: (body: unknown, status?: number) => Response };

/** Parse JSON with a Zod schema. On failure returns a 400 Response the route can return as-is. */
export async function parseBody<T>(
  c: HonoLike,
  schema: z.ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, response: c.json(errBody("Invalid JSON body."), 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.length ? issue.path.join(".") : "body";
    const msg = issue?.message ? `${path}: ${issue.message}` : "Invalid request body.";
    return { ok: false, response: c.json(errBody(msg), 400) };
  }
  return { ok: true, data: parsed.data };
}

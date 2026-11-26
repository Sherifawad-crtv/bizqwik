/** Consistent `{ error, code? }` JSON for Edge responses. Status stays at the call site. */

export function errBody(error: string, code?: string, extra?: Record<string, unknown>) {
  return code ? { error, code, ...extra } : { error, ...extra };
}

export function jsonError(error: string, status = 400, code?: string, extra?: Record<string, unknown>) {
  return Response.json(errBody(error, code, extra), { status });
}

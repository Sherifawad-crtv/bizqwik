/** Phase 3 stub — expand in Phase 5 validation. */
export function jsonError(error: string, status = 400, code?: string) {
  return Response.json(code ? { error, code } : { error }, { status });
}

import { FN_SLUG, supabase } from "../supabaseClient";
import { bump } from "../bus";
import { cleanPath, reportError, track } from "../analytics";

export type Method = "GET" | "POST";

/** A failed call, carrying the server's machine-readable `code` (e.g.
 * "active_plan_confirm") and the full error body, so a screen can react to a
 * specific refusal — like asking "charge a drop-in anyway?" — instead of just
 * showing the message. */
export class ApiError extends Error {
  code: string | null;
  data: Record<string, unknown> | null;
  // HTTP status, or undefined when the request never got an answer (offline, dropped).
  status?: number;
  constructor(message: string, code: string | null, data: Record<string, unknown> | null, status?: number) {
    super(message);
    this.code = code;
    this.data = data;
    this.status = status;
  }
}

// The solo owner's small helper function (drop-in price, InstaPay QR, member-less drop-in).
export const SOLO_DESK = "solo-desk";
// The fast staff client list.
export const CLIENTS_LIST = "clients-list";

export async function callFn<T>(path: string, opts?: { method?: Method; body?: Record<string, unknown>; quiet?: boolean }, slug: string = FN_SLUG): Promise<T> {
  const method = opts?.method ?? "GET";
  const started = performance.now();
  const send = () => supabase.functions.invoke(`${slug}/${path}`, { method, body: opts?.body });
  let { data, error } = await send();
  // A read that never got an answer (phone switching networks, app just woken)
  // is safe to send once more; a POST isn't, it may have gone through.
  if (error && method === "GET" && !(error as { context?: { status?: number } }).context?.status) {
    await new Promise((r) => setTimeout(r, 800));
    ({ data, error } = await send());
  }
  const took = Math.round(performance.now() - started);
  if (error) {
    let message = error.message;
    let code: string | null = null;
    let body: Record<string, unknown> | null = null;
    const ctx = (error as { context?: { json?: () => Promise<Record<string, unknown>>; status?: number } }).context;
    if (ctx?.json) {
      try {
        body = await ctx.json();
        if (typeof body?.error === "string") message = body.error;
        if (typeof body?.code === "string") code = body.code;
      } catch {
        // fall back to the raw error message
      }
    }
    // Every refusal and failure, by endpoint and reason — the broken flows. Only the
    // path (ids stripped), the status and the machine code are sent, never the message.
    const status = (ctx as { status?: number } | undefined)?.status;
    track("api_error", { path: cleanPath(path), method, status, code, ms: took });
    // No answer while offline or in the background is the phone, not a fault of ours.
    const unreachable = status === undefined && (!navigator.onLine || document.visibilityState === "hidden");
    if ((status === undefined || status >= 500) && !unreachable) reportError(error, { path: cleanPath(path), method, status });
    throw new ApiError(message, code, body, status);
  }
  if (method === "POST") track("api_ok", { path: cleanPath(path), method, ms: took });
  else if (took > 3000) track("api_slow", { path: cleanPath(path), method, ms: took });
  // POSTs are the app's only mutations — bump so every mounted useAsync
  // screen revalidates, not just whichever one happened to trigger this.
  // A `quiet` POST (registering this device for notifications) changes nothing
  // a screen shows, so it must not make every open screen load again.
  if (method === "POST" && !opts?.quiet) bump();
  return data as T;
}

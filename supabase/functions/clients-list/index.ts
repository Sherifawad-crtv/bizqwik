import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { loadClients } from "../_shared/clientsCore.ts";

// The staff client list, batched (see _shared/clientsCore.ts). Same access
// rules and the same response as GET /clients on make-server-980e1cbf.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const P = "/clients-list";

async function requireUser(c: any): Promise<{ id: string } | null> {
  const token = (c.req.header("Authorization") || "").replace("Bearer ", "");
  if (!token) return null;
  try {
    const { data, error } = await admin.auth.getClaims(token);
    if (!error && data?.claims) {
      const { sub, role } = data.claims as { sub?: string; role?: string };
      return sub && role === "authenticated" ? { id: sub } : null;
    }
  } catch { /* fall through */ }
  const { data, error } = await admin.auth.getUser(token);
  return error || !data?.user ? null : { id: data.user.id };
}

const app = new Hono();
app.use("*", cors({ origin: "*", allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"], allowMethods: ["GET", "OPTIONS"] }));

app.get(`${P}/clients`, async (c) => {
  const user = await requireUser(c);
  const { data: me } = user ? await admin.from("profiles").select("id, org_id, role").eq("id", user.id).maybeSingle() : { data: null };
  if (!me) return c.json({ error: "Unauthorized" }, 401);
  if (me.role === "accountant") return c.json({ error: "Forbidden" }, 403);
  return c.json({ clients: await loadClients(admin, me) });
});

app.onError((err, c) => {
  console.log("clients-list error", (err as Error)?.message);
  return c.json({ error: "Something went wrong." }, 500);
});

Deno.serve(app.fetch);

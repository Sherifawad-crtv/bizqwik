import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { adminClient } from "../_shared/db.ts";
import { requireUser } from "../_shared/auth.ts";
import { loadClients } from "../_shared/clientsCore.ts";

// The staff client list, batched (see _shared/clientsCore.ts). Same access
// rules and the same response as GET /clients on make-server-980e1cbf.
const admin = adminClient;
const P = "/clients-list";

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

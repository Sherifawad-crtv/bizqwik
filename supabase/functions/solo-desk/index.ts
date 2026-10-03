import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Solo owner's small desk helpers, kept apart from the main backend:
// the one-off drop-in price, her InstaPay QR, and the member-less drop-in.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const P = "/solo-desk";

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

// Only the owner of a solo organization.
async function soloOwner(c: any) {
  const user = await requireUser(c);
  if (!user) return null;
  const { data: me } = await admin.from("profiles").select("id, org_id, role").eq("id", user.id).maybeSingle();
  if (!me || me.role !== "dept_head") return null;
  const { data: org } = await admin.from("organizations").select("mode, dropin_price, instapay_qr").eq("id", me.org_id).maybeSingle();
  if (org?.mode !== "solo") return null;
  return { me, org };
}

const app = new Hono();
app.use("*", cors({ origin: "*", allowHeaders: ["authorization", "x-client-info", "apikey", "content-type"], allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get(`${P}/org-settings`, async (c) => {
  const o = await soloOwner(c);
  if (!o) return c.json({ error: "Forbidden" }, 403);
  return c.json({ dropInPrice: o.org.dropin_price != null ? Number(o.org.dropin_price) : null, instapayQr: o.org.instapay_qr ?? null });
});

app.post(`${P}/org-settings`, async (c) => {
  const o = await soloOwner(c);
  if (!o) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const patch: Record<string, unknown> = {};
  if ("dropInPrice" in body) {
    if (body.dropInPrice === null) patch.dropin_price = null;
    else {
      const n = Number(body.dropInPrice);
      if (!Number.isFinite(n) || n < 0) return c.json({ error: "Enter a valid drop-in price." }, 400);
      patch.dropin_price = n;
    }
  }
  if ("instapayQr" in body) {
    if (body.instapayQr === null) patch.instapay_qr = null;
    else {
      const q = String(body.instapayQr);
      if (!/^data:image\/(png|jpeg|webp);base64,/.test(q) || q.length > 400_000) return c.json({ error: "Upload a smaller image of your InstaPay QR." }, 400);
      patch.instapay_qr = q;
    }
  }
  if (Object.keys(patch).length === 0) return c.json({ error: "Nothing to save." }, 400);
  const { error } = await admin.from("organizations").update(patch).eq("id", o.me.org_id);
  if (error) throw error;
  return c.json({ ok: true });
});

// One drop-in at the price she set, cash or InstaPay, with no member attached.
app.post(`${P}/drop-ins`, async (c) => {
  const o = await soloOwner(c);
  if (!o) return c.json({ error: "Forbidden" }, 403);
  const { payMethod } = await c.req.json();
  if (payMethod !== "cash" && payMethod !== "instapay") return c.json({ error: "Choose cash or InstaPay." }, 400);
  if (o.org.dropin_price == null) return c.json({ error: "Set your drop-in price first (Plans tab)." }, 400);
  const price = Number(o.org.dropin_price);
  const { data: row, error } = await admin.from("drop_ins").insert({ org_id: o.me.org_id, client_id: null, category: "Drop-in", price, pay_method: payMethod }).select().single();
  if (error) throw error;
  await admin.from("activity_log").insert({ org_id: o.me.org_id, actor_id: o.me.id, subject_client_id: null, type: "sale_dropin", amount: price, meta: { payMethod, classId: null, title: "Drop-in" } });
  return c.json({ dropIn: { id: row.id, price, createdAt: row.created_at } });
});

app.onError((err, c) => {
  console.log("solo-desk error", (err as Error)?.message);
  return c.json({ error: "Something went wrong." }, 500);
});

Deno.serve(app.fetch);

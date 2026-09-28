// Tenant-isolation test: can anyone in gym A see or change gym B's data?
//
// Builds two throwaway gyms (zz-iso-a, zz-iso-b) with real data — staff of
// every role, a member with an app login, a PT package, a class bundle, a
// booking, a check-in, logged sessions, a settlement, wallet credit,
// notifications — using the real API. Then every gym A role attacks gym B:
//   1. every list/read route: no gym B id or name may appear in the answer;
//   2. every route that takes an id, called with gym B's ids;
//   3. every table read directly through the database API with A's logins;
//   4. a photo upload into gym B's storage folder.
// Afterwards gym B's rows must be byte-for-byte unchanged, and nothing in
// gym A may point at gym B. Both gyms and their logins are then deleted.
//
// Runs server-side (it needs the service role key): deploy it as a temporary
// edge function and POST to it with the `x-cron-secret` header, once per
// phase, in order — {"phase":"setup-a"}, "setup-b", "attack-1" … "attack-5",
// "verify" (a single run would exceed an edge function's time budget). Phases
// hand over through a scratch table, public.zz_iso_state. "verify" returns
// the report (`ok` is true only when there were no failures) and deletes both
// gyms and their logins.

import { createClient } from "npm:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const FN = `${URL_}/functions/v1/make-server-980e1cbf`;
const db = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const PASSWORD = "ZzIso!2345-test";

const TABLES = [
  "classes", "sessions", "activity_log", "notification_log", "points_ledger", "delivery_logs", "profiles", "check_ins",
  "push_subscriptions", "tiers", "class_bookings", "client_notifications", "clients", "bundle_types", "package_instances",
  "staff_invitations", "class_series", "group_plan_types", "wallets", "org_branding", "points_balances", "group_plans",
  "org_settings", "wallet_transactions", "client_push_subscriptions", "settlements", "membership_types", "client_invitations",
  "client_notes", "invitations", "drop_ins", "membership_instances",
];

// Supabase throttles one function calling another; wait when told to.
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fnFetch(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      await pause(120);
      return await fetch(url, init);
    } catch (err: any) {
      if (attempt < 8 && (err?.name === "RateLimitError" || /rate limit/i.test(String(err?.message)))) {
        await pause((err?.retryAfterMs ?? 5000) + 500);
        continue;
      }
      throw err;
    }
  }
}

type Res = { status: number; text: string; json: any };
async function call(token: string, method: "GET" | "POST", path: string, body?: unknown): Promise<Res> {
  const r = await fnFetch(`${FN}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, apikey: ANON, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch { /* not json */ }
  return { status: r.status, text, json };
}
async function must(token: string, method: "GET" | "POST", path: string, body?: unknown) {
  const r = await call(token, method, path, body);
  if (r.status >= 300) throw new Error(`setup ${method} ${path} → ${r.status} ${r.text.slice(0, 300)}`);
  return r.json;
}
async function signIn(email: string): Promise<string> {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`sign-in failed for ${email}: ${JSON.stringify(j)}`);
  return j.access_token;
}

const createdUsers: string[] = [];
async function makeUser(email: string): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);
  createdUsers.push(data.user.id);
  return data.user.id;
}

const month = new Date().toISOString().slice(0, 7);
const today = new Date().toISOString().slice(0, 10);

async function buildGym(g: "a" | "b", founderId: string) {
  const G = g.toUpperCase();
  const tag = `ZZISO${G}`;
  const { data: org, error } = await db.from("organizations").insert({ name: `${tag} Gym`, slug: `zz-iso-${g}`, created_by: founderId }).select().single();
  if (error) throw error;

  const staff: Record<string, { id: string; token: string; email: string }> = {};
  for (const role of ["dept_head", "front_desk", "coach", "accountant"]) {
    const email = `zz-iso-${g}-${role}@bizqwik.test`;
    const id = await makeUser(email);
    const { error: pErr } = await db.from("profiles").insert({ id, org_id: org.id, role, name: `${tag} ${role}`, email });
    if (pErr) throw pErr;
    staff[role] = { id, email, token: await signIn(email) };
  }
  const head = staff.dept_head.token, desk = staff.front_desk.token, coach = staff.coach.token;

  const tier = (await must(head, "POST", "tiers", { name: `${tag} Tier`, rate: 200, privateCutPct: 50 })).tier;
  await db.from("profiles").update({ tier_id: tier.id }).eq("id", staff.coach.id);
  const bt = (await must(head, "POST", "bundle-types", { name: `${tag} PT 8`, price: 1000, sessionsIncluded: 8, expiryDays: 60 })).bundleType;
  const series = (await must(head, "POST", "class-series", { title: `${tag} HIIT`, weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "20:00", durationMin: 60, dropInPrice: 100, monthlyPrice: 800 })).series;
  const pt = (await must(head, "POST", "plan-types", { kind: "bundle", name: `${tag} 10 Pack`, price: 1000, durationMonths: 2, credits: 10 })).planType;
  await must(head, "POST", "invites", { email: `zz-iso-${g}-pending@bizqwik.test`, role: "coach" });

  // A member with a PT package, a class bundle, wallet credit and an app login.
  const memberEmail = `zz-iso-${g}-member@bizqwik.test`;
  const created = await must(desk, "POST", "clients", { name: `${tag} Member`, email: memberEmail, phone: "01000000000", bundleTypeId: bt.id, coachId: staff.coach.id, payMethod: "cash" });
  const client = created.client;
  const memberUid = await makeUser(memberEmail);
  await db.from("clients").update({ auth_user_id: memberUid }).eq("id", client.id);
  const member = await signIn(memberEmail);
  const { data: pkg } = await db.from("package_instances").select("id, qr_token").eq("client_id", client.id).single();
  await must(desk, "POST", "group-plans/sell", { clientId: client.id, planTypeId: pt.id, payMethod: "cash" });
  await must(head, "POST", "clients/compensate", { clientId: client.id, amount: 500, note: `${tag} credit` });

  const classes = (await must(member, "GET", "client/classes")).classes;
  const cls = classes[0];
  const booking = (await must(member, "POST", `client/classes/${cls.id}/book`, {})).booking;
  await must(desk, "POST", "check-ins", { clientId: client.id, source: "manual" });
  await must(desk, "POST", "drop-ins", { clientId: client.id, category: `${tag} walk-in`, price: 50, payMethod: "cash", confirmActivePlan: true });
  const session = (await must(coach, "POST", "sessions/add", { coachId: staff.coach.id, scanToken: org.coach_qr_token })).session;
  await must(coach, "POST", "packages/deliver", { qrToken: pkg!.qr_token });
  const notif = (await must(member, "GET", "client/notifications")).notifications[0];

  return { g, tag, org, staff, member, memberUid, client, tier, bt, series, pt, cls, booking, pkg: pkg!, session, notif };
}

async function snapshot(orgId: string) {
  const out: Record<string, string> = {};
  for (const t of TABLES) {
    const { data } = await db.from(t).select("*").eq("org_id", orgId);
    const rows = (data ?? []).map((r: any) => JSON.stringify(r, Object.keys(r).sort())).sort();
    out[t] = rows.join("\n");
  }
  const { data: org } = await db.from("organizations").select("*").eq("id", orgId).single();
  out.organizations = JSON.stringify(org);
  return out;
}

type State = { A?: any; B?: any; before?: Record<string, string>; failures: string[]; accepted: string[]; attacks: number; restChecks: number; users: string[] };
async function load(): Promise<State> {
  const { data } = await db.from("zz_iso_state").select("data").eq("id", 1).maybeSingle();
  return (data?.data as State) ?? { failures: [], accepted: [], attacks: 0, restChecks: 0, users: [] };
}
async function save(s: State) {
  await db.from("zz_iso_state").upsert({ id: 1, data: s });
}
const markersOf = (B: any) => [B.org.id, B.client.id, B.staff.coach.id, B.staff.dept_head.id, B.staff.front_desk.id, B.staff.accountant.id, B.tier.id, B.bt.id, B.series.id, B.pt.id, B.cls.id, B.booking.id, B.pkg.id, B.session.id, B.notif.id, B.memberUid, B.pkg.qr_token, B.org.coach_qr_token, "ZZISOB"];

async function cleanup() {
  for (const slug of ["zz-iso-a", "zz-iso-b"]) {
    const { data } = await db.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (data) await db.rpc("delete_org", { p_org: data.id });
  }
  const { data: old } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of old?.users ?? []) {
    if (!u.email?.startsWith("zz-iso-")) continue;
    await db.storage.from("class-images").remove([`${u.id}/zz-hack.jpg`]);
    await db.auth.admin.deleteUser(u.id);
  }
  await db.from("zz_iso_state").delete().eq("id", 1);
}

// The attacks, in batches small enough for one run each.
function batches(st: State) {
  const A = st.A, B = st.B;
  const head = A.staff.dept_head.token, desk = A.staff.front_desk.token, coach = A.staff.coach.token, acct = A.staff.accountant.token, member = A.member;
  const Bc = B.client.id, Bcoach = B.staff.coach.id;
  const markers = markersOf(B);
  const leaked = (text: string) => markers.filter((m) => text.includes(m));
  const attack = async (who: string, token: string, method: "GET" | "POST", path: string, body?: unknown) => {
    st.attacks++;
    const r = await call(token, method, path, body);
    const l = leaked(r.text);
    if (l.length) st.failures.push(`LEAK ${who} ${method} /${path} → ${r.status}: response contains ${l.join(", ")}`);
    else if (method === "POST" && r.status < 300) st.accepted.push(`${who} ${method} /${path} → ${r.status} ${r.text.slice(0, 120)}`);
  };
  const run = async (who: string, token: string, gets: string[], posts: [string, unknown][]) => {
    for (const p of gets) await attack(who, token, "GET", p);
    for (const [p, b] of posts) await attack(who, token, "POST", p, b);
  };

  return {
    "attack-1": () => run("dept_head", head, ["tiers", "bundle-types", "coaches", "invites", "profiles", "clients", `month/${month}`, `sessions/${Bcoach}/${month}`, `packages/by-coach/${Bcoach}/${month}`, "classes", "class-series", "plan-types", `group-plans/client/${Bc}`, "revenue", `classes/${B.cls.id}/bookings`, "activity", "front-desk/summary", `front-desk/client-status/${Bc}`, "ops/summary", "ops/orgs", `ops/orgs/${B.org.id}`, `ops/orgs/${B.org.id}/config`, "ops/team", "ops/plans", "me"], []),
    "attack-2": () => run("dept_head", head, [], [
      ["tiers/update", { id: B.tier.id, name: "hacked", rate: 1, privateCutPct: 0 }],
      ["tiers/delete", { id: B.tier.id }],
      ["bundle-types/update", { id: B.bt.id, name: "hacked", price: 1, sessionsIncluded: 1, expiryDays: 1 }],
      ["bundle-types/delete", { id: B.bt.id }],
      ["invites/delete", { email: "zz-iso-b-pending@bizqwik.test" }],
      ["profiles/assign-tier", { id: Bcoach, tierId: A.tier.id }],
      ["profiles/remove", { id: Bcoach }],
      ["clients/update", { id: Bc, name: "hacked", age: 1, conditions: "hacked" }],
      ["clients/delete", { id: Bc }],
      ["packages", { clientId: Bc, bundleTypeId: A.bt.id, coachId: A.staff.coach.id, payMethod: "cash" }],
      ["packages", { clientId: A.client.id, bundleTypeId: B.bt.id, coachId: Bcoach, payMethod: "cash" }],
      ["clients/assign-coach", { id: Bc, coachId: A.staff.coach.id }],
      ["clients/assign-coach", { id: A.client.id, coachId: Bcoach }],
      ["sessions/add", { coachId: Bcoach, month, date: today }],
      ["sessions/edit", { id: B.session.id, coachId: Bcoach, month, date: today }],
      ["sessions/remove", { id: B.session.id, coachId: Bcoach, month }],
      ["settle", { coachId: Bcoach, month }],
      ["reopen", { coachId: Bcoach, month }],
      ["classes/update", { id: B.cls.id, title: "hacked", description: null, startsAt: B.cls.startsAt, price: 1 }],
      ["classes/cancel", { id: B.cls.id }],
      ["class-series/update", { id: B.series.id, title: "hacked", weekdays: [1], startTime: "10:00", durationMin: 60, dropInPrice: 1, monthlyPrice: 1 }],
      ["class-series/end", { id: B.series.id }],
      ["plan-types/update", { id: B.pt.id, name: "hacked", price: 1, durationMonths: 1, credits: 1 }],
      ["plan-types/delete", { id: B.pt.id }],
      ["bookings/attendance", { bookingId: B.booking.id, attendance: "no_show" }],
      ["bookings/collect", { bookingId: B.booking.id, payMethod: "cash" }],
      ["clients/refund", { clientId: Bc, amount: 100, destination: "wallet" }],
      ["clients/compensate", { clientId: Bc, amount: 100 }],
      ["client-invites", { clientId: Bc, email: "zz-iso-hacked@bizqwik.test" }],
      [`ops/orgs/${B.org.id}/status`, { status: "paused" }],
      [`ops/orgs/${B.org.id}/plan`, { planId: null }],
      [`ops/orgs/${B.org.id}/branding`, { appName: "hacked" }],
      [`ops/orgs/${B.org.id}/settings`, { pointsEarnPerEgp: 99 }],
      [`ops/orgs/${B.org.id}/delete`, { confirmSlug: "zz-iso-b" }],
      ["push/test-admin", { profileId: Bcoach }],
      ["push/client-reminders", {}],
    ]),
    "attack-3": () => run("front_desk", desk, ["clients", `front-desk/client-status/${Bc}`, "front-desk/summary", "class-series", "plan-types", "coaches", `classes/${B.cls.id}/bookings`, `group-plans/client/${Bc}`, "activity", "classes", "bundle-types"], [
      ["check-ins", { clientId: Bc, source: "manual" }],
      ["drop-ins", { clientId: Bc, category: "hack", price: 1, payMethod: "cash", confirmActivePlan: true }],
      ["drop-ins", { clientId: A.client.id, classId: B.cls.id, payMethod: "cash", confirmActivePlan: true }],
      ["invitations", { clientId: Bc, inviteeName: "x", inviteePhone: "1", visitDate: today }],
      ["group-plans/sell", { clientId: Bc, planTypeId: A.pt.id, payMethod: "cash" }],
      ["group-plans/sell", { clientId: A.client.id, planTypeId: B.pt.id, payMethod: "cash" }],
      ["group-plans/sell", { clientId: A.client.id, seriesId: B.series.id, payMethod: "cash" }],
      ["clients", { name: "hack", bundleTypeId: A.bt.id, coachId: Bcoach, payMethod: "cash" }],
      ["clients", { name: "hack", bundleTypeId: B.bt.id, coachId: A.staff.coach.id, payMethod: "cash" }],
      ["packages", { clientId: Bc, bundleTypeId: A.bt.id, coachId: A.staff.coach.id, payMethod: "cash" }],
      ["bookings/collect", { bookingId: B.booking.id, payMethod: "cash" }],
      ["bookings/attendance", { bookingId: B.booking.id, attendance: "no_show" }],
      ["clients/refund", { clientId: Bc, amount: 100, destination: "wallet" }],
      ["client-invites", { clientId: Bc, email: "zz-iso-hacked2@bizqwik.test" }],
      ["clients/assign-coach", { id: Bc, coachId: A.staff.coach.id }],
    ]),
    "attack-4": async () => {
      await run("coach", coach, ["clients", `month/${month}`, `sessions/${Bcoach}/${month}`, "classes", "bundle-types", "tiers"], [
        ["scan", { token: B.org.coach_qr_token }],
        ["scan", { token: B.pkg.qr_token }],
        ["scan", { token: "zz-iso-b" }],
        ["packages/deliver", { qrToken: B.pkg.qr_token }],
        ["sessions/add", { coachId: A.staff.coach.id, scanToken: B.org.coach_qr_token }],
        ["sessions/add", { coachId: Bcoach, scanToken: B.org.coach_qr_token }],
        ["sessions/remove", { id: B.session.id, coachId: Bcoach, month }],
      ]);
      await run("accountant", acct, [`month/${month}`, `packages/by-coach/${Bcoach}/${month}`, `sessions/${Bcoach}/${month}`], [["pay", { coachId: Bcoach, month }]]);
      await run("member", member, ["client/home", "client/classes", "client/bookings", "client/plans", "client/pt", "client/wallet", "client/points", "client/notifications", "me"], [
        [`client/classes/${B.cls.id}/book`, { payMethod: "desk" }],
        [`client/classes/${B.cls.id}/book`, {}],
        [`client/bookings/${B.booking.id}/cancel`, {}],
        ["client/check-in", { token: "zz-iso-b" }],
        ["client/check-in", { token: B.org.id }],
        ["client/plans/buy", { planTypeId: B.pt.id }],
        ["client/plans/buy", { seriesId: B.series.id }],
        ["client/notifications/read", { ids: [B.notif.id] }],
        ["client/points/redeem", {}],
      ]);
    },
    // Straight to the database and storage, bypassing the backend.
    "attack-5": async () => {
      const tokens: [string, string][] = [["dept_head", head], ["front_desk", desk], ["coach", coach], ["accountant", acct], ["member", member]];
      const rest = (token: string, path: string, init: RequestInit = {}) =>
        fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) } });
      for (const [who, token] of tokens) {
        for (const t of [...TABLES, "organizations", "bizqwik_team", "plan_types"]) {
          st.restChecks++;
          const r = await rest(token, `${t}?select=*&limit=1000`);
          const text = await r.text();
          const l = leaked(text);
          if (r.ok && l.length) st.failures.push(`DB READ ${who} reads ${t} → contains ${l.join(", ")}`);
        }
        st.restChecks += 3;
        await rest(token, `clients?id=eq.${Bc}`, { method: "PATCH", body: JSON.stringify({ name: "hacked" }) });
        await rest(token, `client_notifications`, { method: "POST", body: JSON.stringify({ org_id: B.org.id, client_id: Bc, type: "x", title: "hacked", body: "hacked" }) });
        await rest(token, `wallet_transactions?client_id=eq.${Bc}`, { method: "DELETE" });
      }
      const up = await fetch(`${URL_}/storage/v1/object/class-images/${B.staff.dept_head.id}/zz-hack.jpg`, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${head}`, "Content-Type": "image/jpeg" },
        body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      });
      if (up.ok) st.failures.push(`STORAGE dept_head of A uploaded into B's class-images folder (${up.status})`);
      const up2 = await fetch(`${URL_}/storage/v1/object/org-branding/${B.org.id}/logo.jpg`, {
        method: "POST",
        headers: { apikey: ANON, Authorization: `Bearer ${head}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
        body: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      });
      if (up2.ok) st.failures.push(`STORAGE dept_head of A overwrote B's branding logo (${up2.status})`);
    },
  } as Record<string, () => Promise<void>>;
}

Deno.serve(async (req) => {
  const { data: secret } = await db.rpc("get_secret", { secret_name: "cron_secret" });
  if (req.headers.get("x-cron-secret") !== secret) return new Response("Forbidden", { status: 403 });
  const { phase } = await req.json().catch(() => ({}));

  try {
    if (phase === "setup-a") {
      await cleanup();
      const { data: founder } = await db.from("bizqwik_team").select("id").limit(1).single();
      const st: State = { failures: [], accepted: [], attacks: 0, restChecks: 0, users: [] };
      st.A = await buildGym("a", founder!.id);
      await save(st);
      return Response.json({ phase, ok: true });
    }
    const st = await load();
    if (phase === "setup-b") {
      const { data: founder } = await db.from("bizqwik_team").select("id").limit(1).single();
      st.B = await buildGym("b", founder!.id);
      // B settles its coach's month (so there's a settlement to attack).
      await must(st.B.staff.dept_head.token, "POST", "settle", { coachId: st.B.staff.coach.id, month });
      st.before = await snapshot(st.B.org.id);
      await save(st);
      return Response.json({ phase, ok: true });
    }
    if (phase?.startsWith("attack-")) {
      await batches(st)[phase]();
      await save(st);
      return Response.json({ phase, ok: true, attacks: st.attacks, failuresSoFar: st.failures.length });
    }
    if (phase === "verify") {
      const markers = markersOf(st.B);
      const after = await snapshot(st.B.org.id);
      for (const t of Object.keys(st.before!)) {
        if (st.before![t] !== after[t]) st.failures.push(`CHANGED gym B's ${t} rows changed during the attacks`);
      }
      for (const t of TABLES) {
        const { data } = await db.from(t).select("*").eq("org_id", st.A.org.id);
        const l = markers.filter((m) => JSON.stringify(data ?? []).includes(m));
        if (l.length) st.failures.push(`CROSS-LINK gym A's ${t} now references gym B (${l.join(", ")})`);
      }
      await cleanup();
      return Response.json({ ok: st.failures.length === 0, attacks: st.attacks, restChecks: st.restChecks, failures: st.failures, acceptedWrites: st.accepted });
    }
    if (phase === "cleanup") {
      await cleanup();
      return Response.json({ phase, ok: true });
    }
    return Response.json({ error: "Unknown phase" }, { status: 400 });
  } catch (e) {
    return Response.json({ phase, ok: false, error: (e as Error).message }, { status: 500 });
  }
});

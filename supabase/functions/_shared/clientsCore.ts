// The staff client list: every client with their latest PT package, latest
// membership, active group plan and (for coaches/heads) medical conditions.
// Batched: a fixed handful of queries no matter how many clients there are,
// instead of 2–3 queries per client. Output is identical to the original
// /clients endpoint in make-server-980e1cbf.

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

// Reads every row of a query, a page at a time, so nothing is silently cut off.
async function fetchAll(build: () => any): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function toPackageInstance(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    bundleTypeId: row.bundle_type_id,
    coachId: row.coach_id,
    purchaseDate: String(row.purchased_at).slice(0, 10),
    expiryDate: String(row.expires_at).slice(0, 10),
    sessionsIncluded: row.sessions_included,
    sessionsRemaining: row.sessions_remaining,
    priceAtSale: Number(row.price_at_sale),
    coachCutAtSale: Number(row.coach_cut_at_sale),
    status: row.status,
    createdBy: row.created_by,
    locationId: row.location_id ?? null,
  };
}
function toMembershipInstance(row: any) {
  return {
    id: row.id,
    clientId: row.client_id,
    membershipTypeId: row.membership_type_id,
    startDate: String(row.starts_at).slice(0, 10),
    expiryDate: String(row.expires_at).slice(0, 10),
    status: row.status,
    invitationsRemaining: row.invitations_remaining,
  };
}
function toGroupPlan(row: any) {
  return {
    id: row.id, clientId: row.client_id, kind: row.kind, planTypeId: row.plan_type_id ?? null, seriesId: row.series_id ?? null,
    name: row.name, priceAtSale: Number(row.price_at_sale), payMethod: row.pay_method,
    creditsTotal: row.credits_total ?? null, creditsRemaining: row.credits_remaining ?? null,
    invitationsRemaining: row.invitations_remaining, startsAt: row.starts_at, expiresAt: row.expires_at,
    status: row.status, createdAt: row.created_at, locationId: row.location_id ?? null,
  };
}
function toClient(row: any, conditions: string | null, currentPackage: any, currentMembership: any = null) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    phone: row.phone ?? null,
    email: row.email ?? null,
    conditions,
    assignedCoachId: row.assigned_coach_id,
    currentPackage,
    currentMembership,
    homeLocationId: row.home_location_id ?? null,
  };
}

// Same lazy expiry as the main backend: an active package/membership past its
// end date is flipped to expired the moment it's read, and that sticks.
async function materialize(admin: any, table: string, row: any) {
  if (row.status === "active" && todayIso() > String(row.expires_at).slice(0, 10)) {
    const { data, error } = await admin.from(table).update({ status: "expired" }).eq("id", row.id).select().single();
    if (error) throw error;
    return data;
  }
  return row;
}

async function sweepOrgGroupPlans(admin: any, orgId: string) {
  const nowIso = new Date().toISOString();
  await Promise.all([
    admin.from("group_plans").update({ status: "finished" }).eq("org_id", orgId).eq("status", "active").lte("expires_at", nowIso),
    admin.from("group_plans").update({ status: "finished" }).eq("org_id", orgId).eq("status", "active").eq("kind", "bundle").lte("credits_remaining", 0),
  ]);
}

// Newest row per client from a list already ordered newest first.
function latestPerClient(rows: any[]): Map<string, any> {
  const m = new Map<string, any>();
  for (const r of rows) if (!m.has(r.client_id)) m.set(r.client_id, r);
  return m;
}

export async function loadClients(admin: any, me: { id: string; org_id: string; role: string }) {
  const fullRoster = me.role === "dept_head" || me.role === "front_desk";
  const canSeeConditions = me.role !== "front_desk";
  const org = me.org_id;

  const clients = await fetchAll(() => {
    let q = admin.from("clients").select("*").eq("org_id", org);
    if (!fullRoster) q = q.eq("assigned_coach_id", me.id);
    return q.order("name").order("id");
  });
  if (clients.length === 0) return [];
  await sweepOrgGroupPlans(admin, org);

  const mine = new Set(clients.map((c: any) => c.id));
  const [pkgRows, memRows, planRows, noteRows] = await Promise.all([
    fetchAll(() => admin.from("package_instances").select("*").eq("org_id", org).order("purchased_at", { ascending: false }).order("id")),
    fetchAll(() => admin.from("membership_instances").select("*").eq("org_id", org).order("starts_at", { ascending: false }).order("id")),
    fetchAll(() => admin.from("group_plans").select("*").eq("org_id", org).eq("status", "active").order("id")),
    canSeeConditions ? fetchAll(() => admin.from("client_notes").select("client_id, conditions").eq("org_id", org).order("client_id")) : Promise.resolve([]),
  ]);

  const latestPkg = latestPerClient(pkgRows.filter((r) => mine.has(r.client_id)));
  const latestMem = latestPerClient(memRows.filter((r) => mine.has(r.client_id)));
  const planByClient = new Map(planRows.map((p: any) => [p.client_id, p]));
  const notes = new Map(noteRows.filter((n: any) => mine.has(n.client_id)).map((n: any) => [n.client_id, n.conditions ?? null]));

  return await Promise.all(
    clients.map(async (cl: any) => {
      const pRow = latestPkg.get(cl.id);
      const mRow = latestMem.get(cl.id);
      const [pkg, membership] = await Promise.all([
        pRow ? materialize(admin, "package_instances", pRow) : null,
        mRow ? materialize(admin, "membership_instances", mRow) : null,
      ]);
      const plan = planByClient.get(cl.id);
      return {
        ...toClient(cl, canSeeConditions ? (notes.get(cl.id) ?? null) : null, pkg ? toPackageInstance(pkg) : null, membership ? toMembershipInstance(membership) : null),
        groupPlan: plan ? toGroupPlan(plan) : null,
      };
    }),
  );
}

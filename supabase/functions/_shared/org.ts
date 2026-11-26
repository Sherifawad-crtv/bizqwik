/** Org-scoped lookups for Edge (service role). Callers pass me.org_id — never trust body org_id. */
import { admin } from "./db.ts";

export async function clientInOrg(orgId: string, clientId: string) {
  if (!orgId || !clientId) return null;
  const { data } = await admin().from("clients").select("*").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  return data;
}

export async function staffInOrg(orgId: string, profileId: string) {
  if (!orgId || !profileId) return null;
  const { data } = await admin().from("profiles").select("*").eq("id", profileId).eq("org_id", orgId).maybeSingle();
  return data;
}

/** Generic id+org_id lookup. `select` defaults to `*`. */
export async function rowInOrg<T = any>(
  table: string,
  orgId: string,
  id: string,
  select = "*",
): Promise<T | null> {
  if (!orgId || !id) return null;
  const { data } = await admin().from(table).select(select).eq("id", id).eq("org_id", orgId).maybeSingle();
  return (data as T) ?? null;
}

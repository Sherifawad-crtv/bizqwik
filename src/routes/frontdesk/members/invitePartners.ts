import { api, type SalePartner } from "../../../lib/backend";

// A shared sale's new partners have no app invite yet (they didn't exist a
// moment ago); sending it is what lets them sign in with their email.
export async function inviteNewPartners(sharedWith: { id: string; name: string }[] | undefined, partners: SalePartner[]) {
  const failed: string[] = [];
  for (let i = 0; i < partners.length; i++) {
    const p = partners[i];
    const made = sharedWith?.[i];
    if (!("email" in p) || !made) continue;
    try {
      await api.inviteClient(made.id, p.email);
    } catch {
      failed.push(p.name);
    }
  }
  if (failed.length) throw new Error(`Sold, but the app invite to ${failed.join(", ")} failed — re-invite from their client page.`);
}

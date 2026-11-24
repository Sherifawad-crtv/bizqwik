import { useCallback, useEffect, useState } from "react";
import { useAsync } from "../../../../shared/api/useAsync";
import { useSave } from "../../../../shared/api/useSave";
import type { SalePartner } from "../../../../shared/api/backend";
import { useAuth } from "../../../../shared/auth";
import type { GroupPlanType, PayMethod } from "../../../../shared/types";
import type { CoachOption } from "../../domain/types";
import { frontdeskRepository as repo } from "../../data/frontdeskRepository";
import {
  checkAssign,
  checkInvite,
  checkRefund,
  checkSellPackage,
  checkSellPlan,
  isSoloOwner,
  newClientProblem,
  normalEmail,
  offerOf,
  partnerInvites,
  type NewClientForm,
  type Refundable,
  type RefundDest,
} from "../../domain/members";

// ---- Reads -------------------------------------------------------------------

/** What the desk can sell: plan types, running class series and PT bundles. */
export function useFrontDeskCatalog() {
  const { data: p } = useAsync(() => repo.planTypes(), []);
  const { data: s } = useAsync(() => repo.classSeries(), []);
  const { data: b } = useAsync(() => repo.bundleTypes(), []);
  return {
    planTypes: p?.planTypes ?? [],
    series: (s?.series ?? []).filter((x) => x.status === "active"),
    bundleTypes: b?.bundleTypes ?? [],
  };
}

/** Who can be picked as the trainer on a PT sale. A solo owner trains her own
 * clients, so it's just her. */
export function useSellableCoaches(): CoachOption[] {
  const { profile, orgMode } = useAuth();
  const solo = isSoloOwner(profile?.role, orgMode);
  const { data } = useAsync(() => (solo ? Promise.resolve({ coaches: [] as CoachOption[] }) : repo.coaches()), [solo]);
  if (solo && profile) return [{ id: profile.id, name: profile.name, avatarUrl: profile.avatarUrl ?? null } as CoachOption];
  return data?.coaches ?? [];
}

/** What a client has paid less what's already been refunded: the most a refund
 * can be. Fetched while `enabled`; cleared when the client changes. */
export function useRefundable(clientId: string | undefined, enabled: boolean) {
  const [refundable, setRefundable] = useState<Refundable | null>(null);
  useEffect(() => {
    if (clientId) setRefundable(null);
  }, [clientId]);
  useEffect(() => {
    if (!enabled || !clientId) return;
    let alive = true;
    repo.refundable(clientId).then((r) => alive && setRefundable(r)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [enabled, clientId]);
  return refundable;
}

// ---- Writes --------------------------------------------------------------------

// A shared sale's new partners have no app invite yet (they didn't exist a
// moment ago); sending it is what lets them sign in with their email.
async function inviteNewPartners(sharedWith: { id: string; name: string }[] | undefined, partners: SalePartner[]) {
  const failed: string[] = [];
  for (const inv of partnerInvites(partners, sharedWith)) {
    try {
      await repo.inviteClient(inv.id, inv.email);
    } catch {
      failed.push(inv.name);
    }
  }
  if (failed.length) throw new Error(`Sold, but the app invite to ${failed.join(", ")} failed — re-invite from their client page.`);
}

/** The client sheet's actions. Each checks its form, saves, then calls
 * `onSaved`; resolves to true when it saved. */
export function useClientSheetActions(client: { id: string; name: string } | null, onSaved: () => void) {
  const { busy, error, setError, run } = useSave();
  const id = client?.id ?? "";
  const name = client?.name ?? "";
  const refuse = async (msg: string) => {
    setError(msg);
    return false;
  };
  const save = (call: () => Promise<unknown>, fallback?: string) =>
    run(
      async () => {
        await call();
        onSaved();
      },
      fallback ? { fallback } : undefined,
    );
  return {
    busy,
    error,
    setError,
    sellPlan: (offer: string, payMethod: PayMethod, sharedType: GroupPlanType | null, partners: SalePartner[]) => {
      const msg = checkSellPlan(offer, sharedType, partners.length, name);
      if (msg) return refuse(msg);
      return save(async () => {
        const res = await repo.sellGroupPlan({ clientId: id }, offerOf(offer), payMethod, sharedType ? partners : undefined);
        await inviteNewPartners(res.sharedWith, partners);
      });
    },
    sellPackage: (bundleTypeId: string, trainer: string, solo: boolean, payMethod: PayMethod) => {
      const msg = checkSellPackage(bundleTypeId, trainer, solo);
      if (msg) return refuse(msg);
      return save(() => repo.sellPackage(id, bundleTypeId, trainer, payMethod));
    },
    setLocation: (locationId: string | null) => save(() => repo.setClientLocation(id, locationId)),
    assignCoach: (coachId: string) => {
      const msg = checkAssign(coachId);
      if (msg) return refuse(msg);
      return save(() => repo.assignCoach(id, coachId));
    },
    invite: (email: string) => {
      const msg = checkInvite(email);
      if (msg) return refuse(msg);
      return save(() => repo.inviteClient(id, email.trim()));
    },
    refund: (amountText: string, refundable: Refundable | null, solo: boolean, dest: RefundDest, noteText: string) => {
      const checked = checkRefund(amountText, refundable, name, solo, dest, noteText);
      if (!checked.ok) return refuse(checked.error);
      return save(() => repo.refundClient(id, checked.value.amount, dest, checked.value.note));
    },
    logPtSession: (packageId: string) => save(() => repo.logPtSession(packageId), "Couldn't log the session."),
  };
}

/** Create a client with their first plan or PT package, then send their app
 * invite (and the invites of a shared bundle's new partners). If an invite
 * fails, submitting again only re-sends the invites: the client isn't created twice. */
export function useCreateClient(onCreated: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once the client exists, so a retry after a failed invite only re-sends the invite.
  const [createdId, setCreatedId] = useState<string | null>(null);
  // New partners of a shared sale still to be invited (a failed invite is retried on resubmit).
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string }[]>([]);

  const reset = useCallback(() => {
    setCreatedId(null);
    setPendingInvites([]);
    setError(null);
  }, []);

  const submit = async (f: NewClientForm, ctx: { sharedType: GroupPlanType | null; partners: SalePartner[]; payMethod: PayMethod; here: string | null; takenEmails: string[] }) => {
    const check = { sharedType: ctx.sharedType, partners: ctx.partners.length, created: !!createdId, takenEmails: ctx.takenEmails };
    const msg = newClientProblem(0, f, check) ?? newClientProblem(1, f, check);
    if (msg) return setError(msg);
    const mail = normalEmail(f.email);
    const fields = { name: f.name.trim(), phone: f.phone.trim(), email: mail };
    setBusy(true);
    setError(null);
    try {
      let clientId = createdId;
      let invites = pendingInvites;
      if (!clientId) {
        const res = f.kind === "plan" ? await repo.sellGroupPlan(fields, offerOf(f.offer), ctx.payMethod, ctx.sharedType ? ctx.partners : undefined) : await repo.createServiceClient(fields, f.bundleTypeId, f.coachId, ctx.payMethod);
        clientId = res.client.id;
        setCreatedId(clientId);
        invites = partnerInvites(ctx.partners, "sharedWith" in res ? res.sharedWith : undefined).map(({ id, email }) => ({ id, email }));
        setPendingInvites(invites);
        // A new client belongs to the location she's working at.
        if (ctx.here) await repo.setClientLocation(clientId, ctx.here).catch(() => undefined);
      }
      // Register the app invite so the client can sign up with this email.
      try {
        await repo.inviteClient(clientId, mail);
      } catch (err) {
        setError(`Client created, but the app invite failed: ${err instanceof Error ? err.message : "try again"}. Submitting again only re-sends the invite.`);
        return;
      }
      // The shared bundle's new partners need theirs too.
      for (const inv of invites) {
        try {
          await repo.inviteClient(inv.id, inv.email);
        } catch (err) {
          setError(`Sold, but an app invite failed: ${err instanceof Error ? err.message : "try again"}. Submitting again only re-sends the invites.`);
          return;
        }
        invites = invites.filter((x) => x.id !== inv.id);
        setPendingInvites(invites);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, setError, created: !!createdId, reset, submit };
}

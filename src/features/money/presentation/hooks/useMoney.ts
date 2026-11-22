import { useAsync } from "../../../../shared/api/useAsync";
import type { ClientWithPackage } from "../../../../shared/types";
import { moneyRepository as repo } from "../../data/moneyRepository";
import { atLocation, moneyEntries, ofKind, revenueView, toTransactions, totalOfKind, type MoneyKind } from "../../domain/money";

/** How many activity entries the money screens load. */
export const ACTIVITY_LIMIT = 300;

/** The solo owner's money for the last `months`, at one location or all (null). */
export function useMoney(months: number, locationId: string | null, ready: boolean) {
  return useAsync(async () => {
    if (!ready) return null;
    const [rev, pay, act] = await Promise.all([repo.revenue(months), repo.paymentsSummary(months, locationId), repo.activity(ACTIVITY_LIMIT)]);
    const txns = atLocation(toTransactions(act.activity ?? [], months), locationId);
    return { rev, pay, txns };
  }, [months, locationId, ready]);
}

/** The client list, loaded only while a transaction is open. */
export function useClientsWhile(open: boolean) {
  const list = useAsync(() => (open ? repo.clients() : Promise.resolve({ clients: [] as ClientWithPackage[] })), [open]);
  return list.data?.clients ?? [];
}

/** Every money entry in the activity feed, one kind shown, with totals per kind. */
export function useTransactions(kind: MoneyKind) {
  const { data, loading, error } = useAsync(() => repo.activity(ACTIVITY_LIMIT), []);
  const all = moneyEntries(data?.activity ?? []);
  return {
    loading,
    error,
    all,
    shown: ofKind(all, kind),
    totals: { sales: totalOfKind(all, "sales"), refunds: totalOfKind(all, "refunds"), wallet: totalOfKind(all, "wallet") },
  };
}

/** The revenue overview for a range of `months`, compared with the period before. */
export function useRevenueOverview(months: number) {
  // A window twice as long: its older half is the period before, which the
  // comparisons and the "how much history do we have" note come from.
  return useAsync(async () => revenueView(await repo.revenue(months, 24), months), [months]);
}

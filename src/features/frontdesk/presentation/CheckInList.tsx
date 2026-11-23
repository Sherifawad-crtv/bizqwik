import { atLocation, useCurrentLocation } from "../../../shared/locations";
import { useMemo, useState } from "react";
import { useDeskClients } from "./hooks/useDesk";
import { useQuickCheckIn } from "./hooks/useCheckIn";
import { Icon } from "../../../design-system/components/Icon";
import { Spinner } from "../../../design-system/components/Spinner";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { SearchField } from "./shared";
import { PlanPill } from "../../../shared/components/PlanPill";
import { Card } from "../../../design-system/components/Card";
import { matchesClient, planSummary } from "../../../shared/deskStatus";
import { useFrontDeskCatalog } from "./hooks/useMembers";
import "./CheckInList.css";

/** Everyone, searchable, each with a Check in button — for the person who
 * walked in without scanning. Each row answers for itself. */
export function CheckInList() {
  // Where this check-in happens (businesses with locations).
  const { current: here } = useCurrentLocation();
  const { data } = useDeskClients();
  const { bundleTypes } = useFrontDeskCatalog();
  const [query, setQuery] = useState("");
  const { results, checkIn } = useQuickCheckIn(here?.id, (left) => (left ? `${left.left} of ${left.total} sessions left` : "Checked in"));
  // Only clients of the location she's working at.
  const { locations } = useCurrentLocation();
  const at = locations.length > 1 ? (here?.id ?? null) : null;
  const shown = useMemo(() => (data?.clients ?? []).filter((c) => atLocation(c.homeLocationId, at) && matchesClient(c, query)).slice(0, 40), [data, query, at]);

  if (!data) return <Spinner />;

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="Search name or phone" />
      <Card className="bq-mt-2 bq-overflow-hidden" pad="none">
        {shown.map((c, i) => {
          const plan = planSummary(c, bundleTypes);
          const r = results[c.id];
          return (
            <div className="bq-frontdesk-check-in-list-spacing" key={c.id} data-testid="checkin-row" style={{ borderBottom: i === shown.length - 1 ? "none" : "var(--border-divider)" }}>
              <div className="bq-flex bq-items-center bq-gap-3">
                <div className="bq-grow">
                  <div className="bq-frontdesk-check-in-list-title">{c.name}</div>
                  <div className="bq-flex bq-items-center bq-gap-2 bq-mt-0-5">
                    <PlanPill client={c} />
                    <span className="bq-frontdesk-check-in-list-meta">{plan.detail}</span>
                  </div>
                </div>
                {r?.state === "done" ? (
                  <span className="bq-frontdesk-check-in-list-title-2">
                    <Icon name="check" size={18} /> Done
                  </span>
                ) : (
                  <button
                    className="bq-scale bq-frontdesk-check-in-list-btn"
                    disabled={r?.state === "busy"}
                    onClick={() => checkIn(c)}
                    style={{ opacity: r?.state === "busy" ? 0.6 : 1 }}
                  >
                    {r?.state === "busy" ? "…" : "Check in"}
                  </button>
                )}
              </div>
              {r?.state === "done" && <div className="bq-frontdesk-check-in-list-meta-2">{r.note}</div>}
              {r?.state === "error" && (
                <div className="bq-frontdesk-check-in-list-text" role="alert">
                  {r.text}
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 &&
          (data.clients.length === 0 ? (
            <EmptyState bare icon="clients" title="No clients yet" body="Add your first client with New client, or import your members." />
          ) : (
            <EmptyState bare icon="search" title={`No one matches “${query.trim()}”`} body="Check the spelling, or search by phone number." />
          ))}
      </Card>
    </div>
  );
}

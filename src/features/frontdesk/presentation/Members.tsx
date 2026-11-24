import { cx } from "../../../design-system/cx";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetHeader } from "../../../shared/screen/header";
import { useDeskClients } from "./hooks/useDesk";
import type { ClientWithPackage } from "../../../shared/types";
import { LocationSwitcher, atLocation, useCurrentLocation } from "../../../shared/locations";
import { Button } from "../../../design-system/components/Button";
import { Sheet } from "../../../design-system/components/Sheet";
import { Spinner } from "../../../design-system/components/Spinner";
import { Icon } from "../../../design-system/components/Icon";
import { useSticky } from "../../../design-system/hooks/useSticky";
import { SearchField } from "./shared";
import { SheetHeading } from "../../../design-system/components/SheetHeading";
import { PlanPill } from "../../../shared/components/PlanPill";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { endingSoon, matchesClient, planSummary } from "../../../shared/deskStatus";
import { ConfirmCheckInSheet } from "./CheckIn";
import { DropIn } from "./DropIn";
import { useFrontDeskCatalog, useSellableCoaches } from "./hooks/useMembers";
import { CreateClientSheet } from "./members/CreateClientSheet";
import { ClientSheet } from "./members/ClientSheet";
import "./Members.css";

export function Members() {
  useSetHeader({ kicker: "FRONT DESK", title: "Clients" }, []);
  const [params, setParams] = useSearchParams();
  const createRequested = params.get("new") === "1";
  const { data } = useDeskClients();
  const { planTypes, series, bundleTypes } = useFrontDeskCatalog();
  const coaches = useSellableCoaches();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useSticky<"all" | "active" | "soon" | "expired" | "none">("memberFilter", "all", { valid: (v) => ["all", "active", "soon", "expired", "none"].includes(v) });
  const [creating, setCreating] = useState(false);
  const [checkInFor, setCheckInFor] = useState<ClientWithPackage | null>(null);
  const [dropInFor, setDropInFor] = useState<{ id: string; name: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The home screen's "New client" quick action lands on ?new=1. It's read
  // from the URL (not router state) because the tab slide remounts this
  // screen when it finishes, and opening waits for that slide to end.
  useEffect(() => {
    if (!createRequested) return;
    const t = window.setTimeout(() => setCreating(true), 360);
    return () => window.clearTimeout(t);
  }, [createRequested]);
  const closeCreate = () => {
    setCreating(false);
    if (createRequested) setParams({}, { replace: true });
  };

  // Each location keeps its own clients. (Clients from before locations show
  // at both, flagged, until they're given one.)
  const { locations: memberLocations, current: memberHere, ready: locsReady } = useCurrentLocation();
  const here = memberLocations.length > 1 ? (memberHere?.id ?? null) : null;
  const clients = (data?.clients ?? []).filter((c) => atLocation(c.homeLocationId, here));
  const shown = useMemo(() => clients.filter((c) => matchesClient(c, query) && (filter === "all" || (filter === "soon" ? endingSoon(c) !== null : planSummary(c, bundleTypes).tone === filter))), [clients, query, filter, bundleTypes]);
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  if (!locsReady || !data) return <Spinner />;

  return (
    <div>
      <LocationSwitcher />
      <SearchField value={query} onChange={setQuery} />
      <div className="bq-frontdesk-members-row">
        {(["all", "active", "soon", "expired", "none"] as const).map((f) => {
          const n = f === "all" ? clients.length : f === "soon" ? clients.filter((c) => endingSoon(c) !== null).length : clients.filter((c) => planSummary(c, bundleTypes).tone === f).length;
          const on = filter === f;
          return (
            <button
              key={f}
              className="bq-scale"
              onClick={() => setFilter(f)}
              style={{ flex: "none", height: 36, padding: "0 14px", borderRadius: "var(--radius-full)", border: on ? 0 : "1px solid var(--color-border-primary-default)", background: on ? "var(--color-bg-fill-primary-default)" : "var(--color-bg-surface-primary-default)", color: on ? "var(--color-bg-surface-primary-default)" : "var(--color-text-primary-default)", font: "700 var(--text-footnote-size) var(--font-family-body)", cursor: "pointer" }}
            >
              {{ all: "All", active: "Active", soon: "Ending soon", expired: "Expired", none: "No plan" }[f]} · {n}
            </button>
          );
        })}
      </div>

      <div className="bq-mt-4">
        <SectionHeader
          count={shown.length}
          right={
            <Button className="bq-frontdesk-members-btn" size="md" onClick={() => setCreating(true)}>
              + New client
            </Button>
          }
        >
          {{ all: "All clients", active: "Active", soon: "Ending soon", expired: "Expired", none: "No plan" }[filter]}
        </SectionHeader>
      </div>

      <Card className="bq-overflow-hidden" pad="none">
        {shown.map((c, i) => {
          const plan = planSummary(c, bundleTypes);
          const soon = endingSoon(c);
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={cx(`bq-plain bq-listrow bq-listrow--compact ${!(i === shown.length - 1) ? "bq-listrow--divider" : ""}`, "bq-frontdesk-members-btn-2")}
            >
              <div className="bq-grow">
                <div className="bq-frontdesk-members-title">{c.name}</div>
                <div className="bq-frontdesk-members-meta">
                  {plan.title} · {plan.detail}
                  {soon && <span className="bq-frontdesk-members-part"> · {soon.label}</span>}
                  {here && !c.homeLocationId && <span className="bq-frontdesk-members-part-2"> · No location</span>}
                </div>
              </div>
              <PlanPill client={c} />
              <Icon name="chevron-right" size={16} />
            </button>
          );
        })}
        {shown.length === 0 && (
          clients.length === 0 ? (
            <EmptyState bare icon="clients" title="No clients yet" body="Register your first client with + New client. You'll sell them a plan or PT package in the same step, and they get an app invite." />
          ) : (
            <EmptyState bare icon="search" title="No one matches that search" body="Check the spelling, or search by phone number instead." />
          )
        )}
      </Card>

      <CreateClientSheet open={creating} onClose={closeCreate} takenEmails={clients.map((c) => c.email ?? "")} planTypes={planTypes} series={series} bundleTypes={bundleTypes} coaches={coaches} />
      <ConfirmCheckInSheet
        client={checkInFor}
        onClose={() => setCheckInFor(null)}
        onDropIn={(c) => {
          setCheckInFor(null);
          setDropInFor({ id: c.id, name: c.name });
        }}
      />
      <Sheet open={!!dropInFor} onClose={() => setDropInFor(null)}>
        <SheetHeading kicker="FRONT DESK" title="Drop-In" />
        <DropIn embedded initialClient={dropInFor} />
      </Sheet>
      <ClientSheet client={selected} onCheckIn={(c) => { setSelectedId(null); setCheckInFor(c); }} onClose={() => setSelectedId(null)} planTypes={planTypes} series={series} bundleTypes={bundleTypes} coaches={coaches} />
    </div>
  );
}

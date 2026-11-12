import { EmptyState } from "../../components/EmptyState";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import type { ClientWithPackage } from "../../lib/types";
import { LocationSwitcher, atLocation, useCurrentLocation } from "../../lib/locations";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import { useSticky } from "../../lib/useSticky";
import { Card, PlanPill, SearchField, SectionTitle, SheetHeading } from "./shared";
import { endingSoon, matchesClient, planSummary } from "./deskStatus";
import { ConfirmCheckInSheet } from "./CheckIn";
import { DropIn } from "./DropIn";
import { useFrontDeskCatalog, useSellableCoaches } from "./members/offers";
import { CreateClientSheet } from "./members/CreateClientSheet";
import { ClientSheet } from "./members/ClientSheet";

export function Members() {
  useSetHeader({ kicker: "FRONT DESK", title: "Clients" }, []);
  const [params, setParams] = useSearchParams();
  const createRequested = params.get("new") === "1";
  const { data } = useAsync(() => api.clients(), []);
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 4px", overflowX: "auto" }}>
        {(["all", "active", "soon", "expired", "none"] as const).map((f) => {
          const n = f === "all" ? clients.length : f === "soon" ? clients.filter((c) => endingSoon(c) !== null).length : clients.filter((c) => planSummary(c, bundleTypes).tone === f).length;
          const on = filter === f;
          return (
            <button
              key={f}
              className="bq-scale"
              onClick={() => setFilter(f)}
              style={{ flex: "none", height: 36, padding: "0 14px", borderRadius: 999, border: on ? 0 : "1px solid var(--line)", background: on ? "var(--primary)" : "var(--surface)", color: on ? "var(--surface)" : "var(--ink)", font: "700 var(--fs-note) var(--font-body)", cursor: "pointer" }}
            >
              {{ all: "All", active: "Active", soon: "Ending soon", expired: "Expired", none: "No plan" }[f]} · {n}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <SectionTitle
          count={shown.length}
          right={
            <Button size="md" style={{ height: 36, padding: "0 14px" }} onClick={() => setCreating(true)}>
              + New client
            </Button>
          }
        >
          {{ all: "All clients", active: "Active", soon: "Ending soon", expired: "Expired", none: "No plan" }[filter]}
        </SectionTitle>
      </div>

      <Card style={{ overflow: "hidden" }}>
        {shown.map((c, i) => {
          const plan = planSummary(c, bundleTypes);
          const soon = endingSoon(c);
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 64, padding: "12px 18px", border: 0, borderBottom: i === shown.length - 1 ? "none" : "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left" }}
            >
              <div className="bq-grow">
                <div style={{ font: "700 var(--fs-base) var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ font: "400 var(--fs-note) var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {plan.title} · {plan.detail}
                  {soon && <span style={{ color: "var(--logging-fg)", fontWeight: 700 }}> · {soon.label}</span>}
                  {here && !c.homeLocationId && <span style={{ color: "var(--danger-fg)", fontWeight: 700 }}> · No location</span>}
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

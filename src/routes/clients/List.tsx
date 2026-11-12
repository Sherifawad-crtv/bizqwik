import { useState } from "react";
import { useLatch } from "../../lib/useLatch";
import { useIsMobile } from "../../lib/useIsMobile";
import { api } from "../../lib/backend";
import type { ClientWithPackage, Role } from "../../lib/types";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { NO_FILTERS, filterClients, isFiltering, type ClientFilters } from "../../lib/clientFilters";
import { OverviewCards } from "./Overview";
import { ClientFilterBar } from "./Filters";
import { ClientRoster } from "./Roster";
import { ClientActionSheet, ClientDetailSheet, ClientEditSheet } from "./Sheets";

export function ClientList({
  clients,
  role,
  myId,
  coachName,
  showAssignedCoach,
  canManage,
}: {
  clients: ClientWithPackage[];
  role: Role;
  myId: string;
  coachName: (id: string | null) => string | null;
  showAssignedCoach: boolean;
  canManage: boolean;
}) {
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<ClientFilters>(NO_FILTERS);
  const [selected, setSelected] = useState<ClientWithPackage | null>(null);
  const [editing, setEditing] = useState<ClientWithPackage | null>(null);
  const [deleting, setDeleting] = useState<ClientWithPackage | null>(null);
  const [actionsFor, setActionsFor] = useState<ClientWithPackage | null>(null);
  const shownSelected = useLatch(selected);
  const shownEditing = useLatch(editing);
  const shownDeleting = useLatch(deleting);
  const shownActionsFor = useLatch(actionsFor);

  const shown = filterClients(clients, filters);
  const filtering = isFiltering(filters);
  const coachChoices = showAssignedCoach
    ? [...new Set(clients.map((c) => c.assignedCoachId).filter((id): id is string => !!id))]
        .map((id) => ({ id, name: coachName(id) ?? "—" }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : null;

  return (
    <div>
      {clients.length > 0 && <ClientFilterBar clients={clients} filters={filters} onChange={setFilters} coaches={coachChoices} />}
      {!isMobile && <OverviewCards clients={clients} showGroupPlans={canManage} onPick={(patch) => setFilters({ ...patch, sort: filters.sort } as ClientFilters)} />}
      {canManage && !isMobile && (
        <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "-6px 2px 14px" }}>
          New clients, plans and packages are handled at the front desk.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span className="bq-h2">Roster</span>
        <span data-testid="roster-count" className="bq-meta">
          {filtering ? `${shown.length} of ${clients.length} clients` : `${clients.length} clients`}
        </span>
        {filtering && (
          <button
            onClick={() => setFilters({ ...NO_FILTERS, sort: filters.sort })}
            style={{ marginLeft: "auto", border: 0, background: "none", font: "700 13px var(--font-body)", color: "var(--primary-pressed)", cursor: "pointer", padding: 4 }}
          >
            Clear filters
          </button>
        )}
      </div>

      <ClientRoster
        clients={shown}
        filtered={filtering}
        showAssignedCoach={showAssignedCoach}
        canManage={canManage}
        coachName={coachName}
        onSelect={setSelected}
        onEdit={setEditing}
        onDelete={setDeleting}
        onOpenActions={setActionsFor}
      />

      {shownSelected && (
        <ClientDetailSheet
          open={!!selected}
          client={shownSelected}
          role={role}
          myId={myId}
          coachName={coachName}
          onClose={() => setSelected(null)}
        />
      )}

      {canManage && shownActionsFor && (
        <ClientActionSheet
          open={!!actionsFor}
          client={shownActionsFor}
          onClose={() => setActionsFor(null)}
          onEdit={() => {
            // Let the action sheet's own close animation finish before the
            // edit sheet opens — both are portaled full-screen overlays, so
            // opening the next one immediately would flash two backdrops.
            setActionsFor(null);
            window.setTimeout(() => setEditing(shownActionsFor), 260);
          }}
          onDelete={() => {
            setActionsFor(null);
            window.setTimeout(() => setDeleting(shownActionsFor), 260);
          }}
        />
      )}

      {canManage && shownEditing && <ClientEditSheet open={!!editing} client={shownEditing} onClose={() => setEditing(null)} />}

      {canManage && shownDeleting && (
        <ConfirmSheet
          open={!!deleting}
          onClose={() => setDeleting(null)}
          kicker="DELETE CLIENT"
          title={`Delete ${shownDeleting.name}?`}
          sub="This also removes their package and delivery history. This can't be undone."
          confirmLabel="Delete client"
          danger
          onConfirm={async () => {
            await api.deleteClient(shownDeleting.id);
          }}
        />
      )}
    </div>
  );
}

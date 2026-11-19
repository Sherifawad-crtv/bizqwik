import { EmptyState } from "../../design-system/components/EmptyState";
import { useState, type ReactNode } from "react";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { dateLabel, egp } from "../../shared/format";
import type { ClientWithPackage } from "../../shared/types";
import { Icon } from "../../design-system/components/Icon";
import { Avatar } from "../../design-system/components/Avatar";
import { PlanPill } from "../../shared/components/PlanPill";
import { PackageStatusPill } from "../../shared/components/PackageStatusPill";
import { countdownText, groupPlanLine, packageMetaText, rosterGrid } from "./helpers";
import { QUICK_MS, tr } from "../../design-system/motion/motion";
import "./Roster.css";

/** Small round icon button used for the roster's quick actions — stops the
 * click from bubbling to the row, which opens the detail sheet. */
function RowActionButton({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: "pencil" | "trash" | "menu";
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button className="bq-clients-roster-row-action-button-btn"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      style={{ background: danger ? "var(--color-bg-fill-status-danger-default)" : "var(--color-bg-fill-accent-default)", color: danger ? "var(--color-text-status-danger-default)" : "var(--color-bg-fill-primary-active)" }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}

export function ClientRoster({
  clients,
  filtered,
  showAssignedCoach,
  canManage,
  coachName,
  onSelect,
  onEdit,
  onDelete,
  onOpenActions,
}: {
  clients: ClientWithPackage[];
  filtered?: boolean;
  showAssignedCoach: boolean;
  canManage: boolean;
  coachName: (id: string | null) => string | null;
  onSelect: (c: ClientWithPackage) => void;
  onEdit: (c: ClientWithPackage) => void;
  onDelete: (c: ClientWithPackage) => void;
  onOpenActions: (c: ClientWithPackage) => void;
}) {
  const isMobile = useIsMobile();
  const metaFor = (c: ClientWithPackage) => (showAssignedCoach ? (coachName(c.assignedCoachId) ?? "Unassigned") : packageMetaText(c));
  const subFor = (c: ClientWithPackage) =>
    showAssignedCoach
      ? c.groupPlan
        ? `${c.groupPlan.name} · ${groupPlanLine(c.groupPlan)}`
        : c.lastGroupPlan
          ? `${c.lastGroupPlan.name} · ended ${dateLabel(c.lastGroupPlan.expiresAt.slice(0, 10))}`
          : countdownText(c)
      : null;
  // The founder sees the same one-word status as the front desk; a coach sees their PT package's state.
  const pillFor = (c: ClientWithPackage) => (showAssignedCoach ? <PlanPill client={c} /> : c.currentPackage ? <PackageStatusPill status={c.currentPackage.status} /> : null);
  const valueFor = (c: ClientWithPackage) => (c.currentPackage ? egp(c.currentPackage.priceAtSale) : "—");

  if (clients.length === 0 && filtered) {
    return <EmptyState icon="clients" title="No clients match" body="Try a different filter, or clear them to see everyone." />;
  }
  if (clients.length === 0) {
    return showAssignedCoach ? (
      <EmptyState icon="clients" title="No clients yet" body="The front desk registers clients and sells their plans and PT packages. Everyone they add shows up here." />
    ) : (
      <EmptyState icon="clients" title="No PT clients yet" body="When the front desk sells someone a PT package with you, they show up here with their sessions left." />
    );
  }

  if (isMobile) {
    return (
      <div className="bq-stack">
        {clients.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            className="bq-card bq-card--sm bq-flex bq-gap-14px bq-items-center bq-pointer"
          >
            <Avatar name={c.name} size={38} />
            <div className="bq-grow">
              <div className="bq-clients-roster-client-roster-title">{c.name}</div>
              <div className="bq-clients-roster-client-roster-meta">{metaFor(c)}</div>
              <div className="bq-mt-2 bq-flex bq-gap-2 bq-items-center bq-wrap">
                {pillFor(c)}
                {subFor(c) && <span className="bq-meta">{subFor(c)}</span>}
              </div>
            </div>
            {c.currentPackage && (
              <div className="bq-text-right bq-flex-none">
                <div className="tabular bq-stat-sm" >{valueFor(c).split(" ")[0]}</div>
                <div className="bq-label">EGP</div>
              </div>
            )}
            {canManage && (
              <RowActionButton
                icon="menu"
                label="Client actions"
                onClick={() => onOpenActions(c)}
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="bq-panel">
      <div className="bq-clients-roster-client-roster-label" style={{ gridTemplateColumns: rosterGrid(canManage) }}>
        <span>CLIENT</span>
        <span>{showAssignedCoach ? "COACH" : "PACKAGE"}</span>
        <span>STATUS</span>
        <span className="bq-text-right">VALUE</span>
        <span />
      </div>
      {clients.map((c) => (
        <ClientDesktopRow
          key={c.id}
          client={c}
          meta={metaFor(c)}
          sub={subFor(c)}
          pill={pillFor(c)}
          value={valueFor(c)}
          canManage={canManage}
          onClick={() => onSelect(c)}
          onEdit={() => onEdit(c)}
          onDelete={() => onDelete(c)}
        />
      ))}
    </div>
  );
}

function ClientDesktopRow({
  client,
  meta,
  sub,
  pill,
  value,
  canManage,
  onClick,
  onEdit,
  onDelete,
}: {
  client: ClientWithPackage;
  meta: string;
  sub: string | null;
  pill: ReactNode;
  value: string;
  canManage: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div className="bq-clients-roster-client-desktop-row-grid"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ gridTemplateColumns: rosterGrid(canManage), background: hovered ? "var(--color-bg-surface-secondary-default)" : "transparent", transition: tr("background", QUICK_MS) }}
    >
      <div className="bq-flex bq-items-center bq-gap-3 bq-min-w-0">
        <Avatar name={client.name} size={32} />
        <div className="bq-min-w-0">
          <div className="bq-clients-roster-client-desktop-row-text">{client.name}</div>
          {sub && <div className="bq-meta">{sub}</div>}
        </div>
      </div>
      <div className="bq-clients-roster-client-desktop-row-meta">{meta}</div>
      <div>{pill}</div>
      <div className="tabular bq-stat-sm bq-text-right">{value}</div>
      <div className="bq-flex bq-justify-end bq-items-center bq-gap-6px bq-fg-tertiary">
        {canManage && (
          <>
            <RowActionButton icon="pencil" label="Edit client" onClick={onEdit} />
            <RowActionButton icon="trash" label="Delete client" danger onClick={onDelete} />
          </>
        )}
        <Icon name="chevron-right" size={16} />
      </div>
    </div>
  );
}

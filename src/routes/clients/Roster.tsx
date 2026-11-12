import { EmptyState } from "../../components/EmptyState";
import { useState, type ReactNode } from "react";
import { useIsMobile } from "../../lib/useIsMobile";
import { dateLabel, egp } from "../../lib/format";
import type { ClientWithPackage } from "../../lib/types";
import { Icon } from "../../components/Icon";
import { Avatar } from "../../components/Avatar";
import { PlanPill } from "../frontdesk/shared";
import { PackageStatusPill } from "../../components/PackageStatusPill";
import { countdownText, groupPlanLine, packageMetaText, rosterGrid } from "./helpers";

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
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      style={{
        width: 32,
        height: 32,
        flex: "none",
        borderRadius: 999,
        border: 0,
        background: danger ? "var(--danger-bg)" : "var(--primary-tint)",
        color: danger ? "var(--danger-fg)" : "var(--primary-pressed)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
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
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {clients.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelect(c)}
            style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 16px", display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }}
          >
            <Avatar name={c.name} size={38} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{metaFor(c)}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {pillFor(c)}
                {subFor(c) && <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{subFor(c)}</span>}
              </div>
            </div>
            {c.currentPackage && (
              <div style={{ textAlign: "right", flex: "none" }}>
                <div className="tabular" style={{ font: "800 20px var(--font-body)", letterSpacing: "-.01em" }}>{valueFor(c).split(" ")[0]}</div>
                <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>EGP</div>
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
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: rosterGrid(canManage), gap: 12, padding: "10px 20px", background: "var(--sunken)", font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-muted)" }}>
        <span>CLIENT</span>
        <span>{showAssignedCoach ? "COACH" : "PACKAGE"}</span>
        <span>STATUS</span>
        <span style={{ textAlign: "right" }}>VALUE</span>
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
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: rosterGrid(canManage),
        gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid var(--line)",
        alignItems: "center",
        cursor: "pointer",
        background: hovered ? "var(--sunken)" : "transparent",
        transition: "background .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={client.name} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "600 16px var(--font-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{client.name}</div>
          {sub && <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{sub}</div>}
        </div>
      </div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</div>
      <div>{pill}</div>
      <div className="tabular" style={{ textAlign: "right", font: "800 20px var(--font-body)", letterSpacing: "-.01em" }}>{value}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6, color: "var(--ink-faint)" }}>
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

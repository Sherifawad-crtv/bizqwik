import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { useLatch } from "../lib/useLatch";
import { useIsMobile } from "../lib/useIsMobile";
import { api, MOCK } from "../lib/backend";
import { dateLabel, egp, fmt } from "../lib/format";
import { canLog, PACKAGE_STATUS_LABELS } from "../lib/types";
import type { BundleType, ClientWithPackage, PackageStatus, Role } from "../lib/types";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { Spinner } from "../components/Spinner";
import { Sheet } from "../components/Sheet";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { TextField, SelectField } from "../components/FormField";
import { NewClientWizardSheet } from "../components/NewClientWizardSheet";

interface CoachOption {
  id: string;
  name: string;
}

const PKG_COLORS: Record<PackageStatus, { fg: string; bg: string }> = {
  active: { fg: "var(--paid-fg)", bg: "var(--paid-bg)" },
  exhausted: { fg: "var(--ink-muted)", bg: "var(--sunken)" },
  expired: { fg: "var(--danger-fg)", bg: "var(--danger-bg)" },
};

function PackageStatusPill({ status }: { status: PackageStatus }) {
  const c = PKG_COLORS[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        font: "700 11px var(--font-mono)",
        letterSpacing: ".08em",
        whiteSpace: "nowrap",
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: 999, background: c.fg, display: "block" }} />
      {PACKAGE_STATUS_LABELS[status].toUpperCase()}
    </span>
  );
}

function daysLeft(expiryDate: string): number {
  return Math.max(0, Math.ceil((Date.parse(expiryDate) - Date.now()) / 86400000));
}

function countdownText(client: ClientWithPackage): string | null {
  const pkg = client.currentPackage;
  if (!pkg || pkg.status !== "active") return null;
  return `${pkg.sessionsRemaining} of ${pkg.sessionsIncluded} left · ${daysLeft(pkg.expiryDate)} days left`;
}

/** Own-package meta line: distinguishes "never bought a package" from
 * "had one, but it's exhausted/expired" — the status pill next to this text
 * already names which, so this fills in what the pill can't: how long is
 * left (active) or when it ended. */
function packageMetaText(client: ClientWithPackage): string {
  const pkg = client.currentPackage;
  if (!pkg) return "No package yet";
  if (pkg.status === "active") return countdownText(client)!;
  return `Sold ${dateLabel(pkg.purchaseDate)}`;
}

const EXPIRING_SOON_DAYS = 7;

function OverviewCards({ clients }: { clients: ClientWithPackage[] }) {
  const stats = [
    { k: "TOTAL CLIENTS", v: clients.length },
    { k: "ACTIVE PACKAGES", v: clients.filter((c) => c.currentPackage?.status === "active").length },
    { k: "NEEDS RENEWAL", v: clients.filter((c) => c.currentPackage && c.currentPackage.status !== "active").length },
    {
      k: "EXPIRING SOON",
      v: clients.filter((c) => c.currentPackage?.status === "active" && daysLeft(c.currentPackage.expiryDate) <= EXPIRING_SOON_DAYS).length,
    },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 18 }}>
      {stats.map((s) => (
        <div key={s.k} data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "16px 18px" }}>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{s.k}</div>
          <div className="tabular" style={{ font: "800 30px var(--font-body)", letterSpacing: "-.02em", marginTop: 6 }}>{s.v}</div>
        </div>
      ))}
    </div>
  );
}

export function Clients() {
  const { profile } = useAuth();
  // Only dept_head gets department-wide admin capability (create clients,
  // sell/renew packages, assign/reassign) — and sees the full roster, full
  // stop, no "mine" sub-view. Head coach's private-training role is the
  // same as a plain coach's: view their own assigned clients and log
  // deliveries against them, nothing more.
  const isDeptHead = profile?.role === "dept_head";

  const { data } = useAsync(() => api.clients(), []);
  const { data: bundleData } = useAsync(() => (isDeptHead ? api.bundleTypes() : Promise.resolve(null)), [isDeptHead]);
  const { data: monthData } = useAsync(() => (isDeptHead ? api.month(MOCK.CURRENT_MONTH) : Promise.resolve(null)), [isDeptHead]);

  useSetHeader({ kicker: "PRIVATE TRAINING", title: "Clients" }, []);

  if (!profile) return null;
  if (!data) return <Spinner />;

  const coachOptions: CoachOption[] = (monthData?.rows ?? []).filter((r) => canLog(r.role)).map((r) => ({ id: r.coachId, name: r.name }));
  const bundleTypes: BundleType[] = bundleData?.bundleTypes ?? [];
  const visibleClients = isDeptHead ? data.clients : data.clients.filter((c) => c.assignedCoachId === profile.id);
  const coachName = (id: string | null) => (id ? (coachOptions.find((c) => c.id === id)?.name ?? "—") : null);

  return (
    <ClientList
      clients={visibleClients}
      role={profile.role}
      myId={profile.id}
      coachOptions={coachOptions}
      bundleTypes={bundleTypes}
      coachName={coachName}
      showAssignedCoach={isDeptHead}
      canManage={isDeptHead}
    />
  );
}

function ClientList({
  clients,
  role,
  myId,
  coachOptions,
  bundleTypes,
  coachName,
  showAssignedCoach,
  canManage,
}: {
  clients: ClientWithPackage[];
  role: Role;
  myId: string;
  coachOptions: CoachOption[];
  bundleTypes: BundleType[];
  coachName: (id: string | null) => string | null;
  showAssignedCoach: boolean;
  canManage: boolean;
}) {
  const [selected, setSelected] = useState<ClientWithPackage | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [editing, setEditing] = useState<ClientWithPackage | null>(null);
  const [deleting, setDeleting] = useState<ClientWithPackage | null>(null);
  const shownSelected = useLatch(selected);
  const shownEditing = useLatch(editing);
  const shownDeleting = useLatch(deleting);

  return (
    <div>
      <OverviewCards clients={clients} />

      {canManage && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <Button size="md" style={{ height: 40, padding: "0 16px" }} onClick={() => setNewClientOpen(true)}>
            + New client
          </Button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "2px 2px 8px" }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Roster</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{clients.length} clients</span>
      </div>

      <ClientRoster
        clients={clients}
        showAssignedCoach={showAssignedCoach}
        canManage={canManage}
        coachName={coachName}
        onSelect={setSelected}
        onEdit={setEditing}
        onDelete={setDeleting}
      />

      {shownSelected && (
        <ClientDetailSheet
          open={!!selected}
          client={shownSelected}
          role={role}
          myId={myId}
          coachOptions={coachOptions}
          bundleTypes={bundleTypes}
          coachName={coachName}
          onClose={() => setSelected(null)}
        />
      )}

      {canManage && <NewClientWizardSheet open={newClientOpen} onClose={() => setNewClientOpen(false)} />}

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

function rosterGrid(canManage: boolean): string {
  return `2fr 1.3fr 1fr 1.1fr ${canManage ? "84px" : "20px"}`;
}

/** Small round icon button used for the roster's quick actions — stops the
 * click from bubbling to the row, which opens the detail sheet. */
function RowActionButton({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: "pencil" | "trash";
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

function ClientRoster({
  clients,
  showAssignedCoach,
  canManage,
  coachName,
  onSelect,
  onEdit,
  onDelete,
}: {
  clients: ClientWithPackage[];
  showAssignedCoach: boolean;
  canManage: boolean;
  coachName: (id: string | null) => string | null;
  onSelect: (c: ClientWithPackage) => void;
  onEdit: (c: ClientWithPackage) => void;
  onDelete: (c: ClientWithPackage) => void;
}) {
  const isMobile = useIsMobile();
  const metaFor = (c: ClientWithPackage) => (showAssignedCoach ? (coachName(c.assignedCoachId) ?? "Unassigned") : packageMetaText(c));
  const subFor = (c: ClientWithPackage) => (showAssignedCoach ? countdownText(c) : null);
  const valueFor = (c: ClientWithPackage) => (c.currentPackage ? egp(c.currentPackage.priceAtSale) : "—");

  if (clients.length === 0) {
    return (
      <div
        data-sq
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-tile)",
          padding: "32px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          color: "var(--ink-faint)",
          font: "500 14px var(--font-body)",
        }}
      >
        <Icon name="clients" size={26} />
        Nothing here yet.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {clients.map((c) => (
          <div
            key={c.id}
            data-sq
            onClick={() => onSelect(c)}
            style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 16px", display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }}
          >
            <Avatar name={c.name} size={38} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{metaFor(c)}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {c.currentPackage && <PackageStatusPill status={c.currentPackage.status} />}
                {subFor(c) && <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{subFor(c)}</span>}
                {c.currentPackage && (
                  <span className="tabular" style={{ marginLeft: "auto", font: "800 14px var(--font-body)", letterSpacing: "-.01em" }}>
                    {valueFor(c)}
                  </span>
                )}
              </div>
            </div>
            {canManage && (
              <div style={{ display: "flex", gap: 6, flex: "none" }}>
                <RowActionButton icon="pencil" label="Edit client" onClick={() => onEdit(c)} />
                <RowActionButton icon="trash" label="Delete client" danger onClick={() => onDelete(c)} />
              </div>
            )}
            <span style={{ flex: "none", color: "var(--ink-faint)", display: "flex" }}>
              <Icon name="chevron-right" size={16} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
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
  value,
  canManage,
  onClick,
  onEdit,
  onDelete,
}: {
  client: ClientWithPackage;
  meta: string;
  sub: string | null;
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
      <div>{client.currentPackage && <PackageStatusPill status={client.currentPackage.status} />}</div>
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

function ClientDetailSheet({
  open,
  client,
  role,
  myId,
  coachOptions,
  bundleTypes,
  coachName,
  onClose,
}: {
  open: boolean;
  client: ClientWithPackage;
  role: Role;
  myId: string;
  coachOptions: CoachOption[];
  bundleTypes: BundleType[];
  coachName: (id: string | null) => string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "sell">("view");
  const [bundleTypeId, setBundleTypeId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode("view");
      setBundleTypeId("");
      setCoachId(role === "coach" ? myId : "");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client.id]);

  const pkg = client.currentPackage;
  const canSell = role === "dept_head" && (!pkg || pkg.status !== "active");
  const canDeliver = role !== "accountant" && client.assignedCoachId === myId && !!pkg && pkg.status === "active";

  const sell = async () => {
    if (!bundleTypeId || !coachId) {
      setError("Pick a bundle and a coach.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.sellPackage(client.id, bundleTypeId, coachId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const deliver = async () => {
    if (!pkg) return;
    setBusy(true);
    setError(null);
    try {
      await api.deliverSession(pkg.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <Avatar name={client.name} size={44} />
        <div>
          <div style={{ font: "800 22px var(--font-body)", letterSpacing: "-.01em" }}>{client.name}</div>
          {client.age != null && <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>Age {client.age}</div>}
        </div>
      </div>

      {mode === "view" && (
        <>
          {client.conditions && (
            <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>CONDITIONS</div>
              <div style={{ font: "600 15px/1.4 var(--font-body)" }}>{client.conditions}</div>
            </div>
          )}

          <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px", marginBottom: 10 }}>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>COACH</div>
            <div style={{ font: "600 16px var(--font-body)" }}>{coachName(client.assignedCoachId) ?? "Unassigned"}</div>
          </div>

          {pkg ? (
            <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>CURRENT PACKAGE</span>
                <PackageStatusPill status={pkg.status} />
              </div>
              {pkg.status === "active" && (
                <div style={{ font: "600 15px var(--font-body)", marginBottom: 4 }}>
                  {pkg.sessionsRemaining} of {pkg.sessionsIncluded} sessions left · {daysLeft(pkg.expiryDate)} days left
                </div>
              )}
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>
                {egp(pkg.priceAtSale)} paid · {egp(pkg.coachCutAtSale)} coach cut
              </div>
            </div>
          ) : (
            <div style={{ font: "500 14px var(--font-body)", color: "var(--ink-faint)", marginBottom: 10 }}>No package sold yet.</div>
          )}

          {error && (
            <div style={{ marginBottom: 10, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
            </div>
          )}

          {canDeliver && (
            <Button fullWidth size="lg" style={{ marginTop: 6 }} disabled={busy} onClick={deliver}>
              {busy ? "Logging…" : "Log delivered session"}
            </Button>
          )}
          {canSell && (
            <Button fullWidth size="lg" style={{ marginTop: 6 }} onClick={() => setMode("sell")}>
              {pkg ? "Sell / renew package" : "Sell package"}
            </Button>
          )}
          <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose}>
            Close
          </Button>
        </>
      )}

      {mode === "sell" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SelectField
              label="BUNDLE"
              value={bundleTypeId}
              onChange={setBundleTypeId}
              placeholder="Choose a bundle"
              options={bundleTypes.map((b) => ({ value: b.id, label: `${b.name} · ${fmt(b.price)} EGP` }))}
            />
            <SelectField
              label="COACH"
              value={coachId}
              onChange={setCoachId}
              placeholder="Choose a coach"
              options={coachOptions.map((c) => ({ value: c.id, label: c.name }))}
            />
          </div>
          {error && (
            <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
            </div>
          )}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={sell}>
            {busy ? "Selling…" : "Confirm sale"}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={() => setMode("view")} disabled={busy}>
            Back
          </Button>
        </>
      )}
    </Sheet>
  );
}

function ClientEditSheet({ open, client, onClose }: { open: boolean; client: ClientWithPackage; onClose: () => void }) {
  const [name, setName] = useState(client.name);
  const [age, setAge] = useState(client.age != null ? String(client.age) : "");
  const [conditions, setConditions] = useState(client.conditions ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(client.name);
      setAge(client.age != null ? String(client.age) : "");
      setConditions(client.conditions ?? "");
      setError(null);
    }
  }, [open, client]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateClient(client.id, name.trim(), age.trim() ? Number(age) : null, conditions.trim() || null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>EDIT CLIENT</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{client.name}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
        <TextField label="AGE (OPTIONAL)" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
        <TextField label="CONDITIONS (OPTIONAL)" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Only visible to their coach and heads" />
      </div>
      {error && (
        <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
          {error}
        </div>
      )}
      <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
        {busy ? "Saving…" : "Save changes"}
      </Button>
      <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
        Cancel
      </Button>
    </Sheet>
  );
}

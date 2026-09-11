import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { useLatch } from "../lib/useLatch";
import { api, MOCK } from "../lib/backend";
import { egp, fmt } from "../lib/format";
import { canLog, isHead, PACKAGE_STATUS_LABELS } from "../lib/types";
import type { BundleType, ClientWithPackage, PackageStatus, Role } from "../lib/types";
import { Segmented } from "../components/Segmented";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { Spinner } from "../components/Spinner";
import { Sheet } from "../components/Sheet";
import { TextField, SelectField } from "../components/FormField";

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

export function Clients() {
  const { profile } = useAuth();
  const head = !!profile && isHead(profile.role);
  const [scope, setScope] = useState<"mine" | "all">("all");

  const { data } = useAsync(() => api.clients(), []);
  const { data: bundleData } = useAsync(() => (head ? api.bundleTypes() : Promise.resolve(null)), [head]);
  const { data: monthData } = useAsync(() => (head ? api.month(MOCK.CURRENT_MONTH) : Promise.resolve(null)), [head]);

  useSetHeader(
    {
      kicker: "PRIVATE TRAINING",
      title: "Clients",
      right: head ? (
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: "mine", label: "MY CLIENTS" },
            { value: "all", label: "ALL CLIENTS" },
          ]}
        />
      ) : undefined,
    },
    [scope, head],
  );

  if (!profile) return null;
  if (!data) return <Spinner />;

  const coachOptions: CoachOption[] = (monthData?.rows ?? []).filter((r) => canLog(r.role)).map((r) => ({ id: r.coachId, name: r.name }));
  const bundleTypes: BundleType[] = bundleData?.bundleTypes ?? [];
  const visibleClients = !head || scope === "mine" ? data.clients.filter((c) => c.assignedCoachId === profile.id) : data.clients;
  const coachName = (id: string | null) => (id ? (coachOptions.find((c) => c.id === id)?.name ?? "—") : null);

  return (
    <ClientList
      clients={visibleClients}
      role={profile.role}
      myId={profile.id}
      coachOptions={coachOptions}
      bundleTypes={bundleTypes}
      coachName={coachName}
      showAssignedCoach={head && scope === "all"}
      showNewClient={profile.role === "dept_head" && scope === "all"}
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
  showNewClient,
}: {
  clients: ClientWithPackage[];
  role: Role;
  myId: string;
  coachOptions: CoachOption[];
  bundleTypes: BundleType[];
  coachName: (id: string | null) => string | null;
  showAssignedCoach: boolean;
  showNewClient: boolean;
}) {
  const [selected, setSelected] = useState<ClientWithPackage | null>(null);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const shownSelected = useLatch(selected);

  return (
    <div>
      {showNewClient && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <Button size="md" style={{ height: 40, padding: "0 16px" }} onClick={() => setNewClientOpen(true)}>
            + New client
          </Button>
        </div>
      )}

      {clients.length === 0 ? (
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {clients.map((c) => (
            <div
              key={c.id}
              data-sq
              onClick={() => setSelected(c)}
              style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 16px", display: "flex", gap: 14, alignItems: "center", cursor: "pointer" }}
            >
              <Avatar name={c.name} size={38} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: "700 16px var(--font-body)", letterSpacing: "-.01em" }}>{c.name}</div>
                <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>
                  {showAssignedCoach ? (coachName(c.assignedCoachId) ?? "UNASSIGNED") : countdownText(c) ?? "No package yet"}
                </div>
                {showAssignedCoach && countdownText(c) && (
                  <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>{countdownText(c)}</div>
                )}
                <div style={{ marginTop: 8 }}>{c.currentPackage ? <PackageStatusPill status={c.currentPackage.status} /> : null}</div>
              </div>
              <Icon name="chevron-right" size={16} />
            </div>
          ))}
        </div>
      )}

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

      {showNewClient && <NewClientSheet open={newClientOpen} onClose={() => setNewClientOpen(false)} />}
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
  const [mode, setMode] = useState<"view" | "sell" | "assign">("view");
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
  const canAssign = (role === "dept_head" || role === "head_coach") && client.assignedCoachId === null;
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

  const assign = async () => {
    if (!coachId) {
      setError("Pick a coach.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.assignCoach(client.id, coachId);
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
          {canAssign && (
            <Button fullWidth size="lg" style={{ marginTop: 6 }} onClick={() => setMode("assign")}>
              Assign a coach
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

      {mode === "assign" && (
        <>
          <SelectField
            label="COACH"
            value={coachId}
            onChange={setCoachId}
            placeholder="Choose a coach"
            options={coachOptions.map((c) => ({ value: c.id, label: c.name }))}
          />
          {error && (
            <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
            </div>
          )}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={assign}>
            {busy ? "Assigning…" : "Confirm assignment"}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={() => setMode("view")} disabled={busy}>
            Back
          </Button>
        </>
      )}
    </Sheet>
  );
}

function NewClientSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [conditions, setConditions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setAge("");
      setConditions("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createClient(name.trim(), age.trim() ? Number(age) : null, conditions.trim() || null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>NEW CLIENT</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>New client</div>
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
        {busy ? "Creating…" : "Create client"}
      </Button>
      <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
        Cancel
      </Button>
    </Sheet>
  );
}

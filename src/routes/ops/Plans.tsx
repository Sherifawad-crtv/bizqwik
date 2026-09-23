import { useState } from "react";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { egp } from "../../lib/format";
import type { PlanType } from "../../lib/types";
import { Spinner } from "../../components/Spinner";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { TextField } from "../../components/FormField";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { Card, SectionTitle, ErrorBanner, limitLabel } from "./shared";

function PlanSheet({ open, onClose, plan, onDone }: { open: boolean; onClose: () => void; plan: PlanType | null; onDone: () => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [team, setTeam] = useState("");
  const [client, setClient] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);

  // Seed the fields from the plan being edited, once per open.
  const key = open ? (plan?.id ?? "new") : null;
  if (key && key !== seeded) {
    setName(plan?.name ?? "");
    setPrice(plan ? String(plan.price) : "");
    setTeam(plan?.teamSizeLimit != null ? String(plan.teamSizeLimit) : "");
    setClient(plan?.clientSizeLimit != null ? String(plan.clientSizeLimit) : "");
    setError(null);
    setSeeded(key);
  }

  const close = () => {
    setSeeded(null);
    onClose();
  };

  const submit = async () => {
    setError(null);
    const priceNum = Number(price);
    if (!name.trim()) return setError("Name is required.");
    if (!Number.isFinite(priceNum) || priceNum < 0) return setError("Price must be zero or more.");
    const teamLimit = team.trim() === "" ? null : Number(team);
    const clientLimit = client.trim() === "" ? null : Number(client);
    if (teamLimit !== null && (!Number.isInteger(teamLimit) || teamLimit < 1)) return setError("Team limit must be a whole number of 1 or more, or blank for unlimited.");
    if (clientLimit !== null && (!Number.isInteger(clientLimit) || clientLimit < 1)) return setError("Client limit must be a whole number of 1 or more, or blank for unlimited.");
    setBusy(true);
    try {
      if (plan) await api.ops.updatePlan(plan.id, name.trim(), priceNum, teamLimit, clientLimit);
      else await api.ops.createPlan(name.trim(), priceNum, teamLimit, clientLimit);
      close();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{plan ? "EDIT PLAN" : "NEW PLAN"}</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{plan ? plan.name : "Create a SaaS plan"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Growth" />
        <TextField label="PRICE (EGP / MONTH)" type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        <TextField label="TEAM LIMIT (BLANK = UNLIMITED)" type="number" inputMode="numeric" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Unlimited" />
        <TextField label="CLIENT LIMIT (BLANK = UNLIMITED)" type="number" inputMode="numeric" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Unlimited" />
        {error && <ErrorBanner text={error} />}
        <Button fullWidth size="lg" disabled={busy} onClick={submit} style={{ marginTop: 4 }}>
          {busy ? "Saving…" : plan ? "Save changes" : "Create plan"}
        </Button>
      </div>
    </Sheet>
  );
}

export function Plans() {
  const plansRes = useAsync(() => api.ops.plans(), []);
  const [editing, setEditing] = useState<PlanType | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState<PlanType | null>(null);

  if (plansRes.loading) return <Spinner />;
  const plans = plansRes.data?.plans ?? [];

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };
  const openEdit = (p: PlanType) => {
    setEditing(p);
    setSheetOpen(true);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>Plans</div>
        <Button onClick={openNew} style={{ marginLeft: "auto" }}>
          <Icon name="plus" size={18} /> New plan
        </Button>
      </div>

      {plansRes.error && <ErrorBanner text={plansRes.error} />}

      <SectionTitle count={plans.length}>SaaS plans</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {plans.map((p) => (
          <Card key={p.id} style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 17px var(--font-body)" }}>{p.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 3 }}>
                {egp(p.price)}/mo · {limitLabel(p.teamSizeLimit)} staff · {limitLabel(p.clientSizeLimit)} clients
              </div>
            </div>
            <button onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} style={{ border: 0, background: "var(--sunken)", borderRadius: 12, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-muted)", cursor: "pointer", flex: "none" }}>
              <Icon name="pencil" size={17} />
            </button>
            <button onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`} style={{ border: 0, background: "var(--danger-bg)", borderRadius: 12, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--danger-fg)", cursor: "pointer", flex: "none" }}>
              <Icon name="trash" size={17} />
            </button>
          </Card>
        ))}
        {plans.length === 0 && (
          <Card style={{ padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
            <Icon name="tag" size={26} />
            No plans yet — create your first one.
          </Card>
        )}
      </div>

      <PlanSheet open={sheetOpen} onClose={() => setSheetOpen(false)} plan={editing} onDone={() => plansRes.refetch()} />
      <ConfirmSheet
        open={!!deleting}
        onClose={() => setDeleting(null)}
        kicker="DELETE PLAN"
        title={deleting ? `Delete "${deleting.name}"?` : ""}
        sub="This can't be undone. An org currently on this plan will block the delete."
        confirmLabel="Delete plan"
        danger
        onConfirm={async () => {
          if (deleting) await api.ops.deletePlan(deleting.id);
          plansRes.refetch();
        }}
      />
    </div>
  );
}

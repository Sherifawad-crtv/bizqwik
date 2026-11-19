import { EmptyState } from "../../design-system/components/EmptyState";
import { useState } from "react";
import { api } from "../../shared/api/backend";
import { useAsync } from "../../shared/api/useAsync";
import { egp } from "../../shared/format";
import type { PlanType } from "../../shared/types";
import { Spinner } from "../../design-system/components/Spinner";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Sheet } from "../../design-system/components/Sheet";
import { TextField } from "../../design-system/components/FormField";
import { ConfirmSheet } from "../../design-system/components/ConfirmSheet";
import { ErrorBanner } from "../../design-system/components/ErrorBanner";
import { Card } from "../../design-system/components/Card";
import { SectionHeader } from "../../design-system/components/SectionHeader";
import { limitLabel } from "./format";
import "./Plans.css";

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
      <div className="bq-label">{plan ? "EDIT PLAN" : "NEW PLAN"}</div>
      <div className="bq-title">{plan ? plan.name : "Create a SaaS plan"}</div>
      <div className="bq-stack">
        <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Growth" />
        <TextField label="PRICE (EGP / MONTH)" type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
        <TextField label="TEAM LIMIT (BLANK = UNLIMITED)" type="number" inputMode="numeric" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="Unlimited" />
        <TextField label="CLIENT LIMIT (BLANK = UNLIMITED)" type="number" inputMode="numeric" value={client} onChange={(e) => setClient(e.target.value)} placeholder="Unlimited" />
        {error && <ErrorBanner text={error} />}
        <Button className="bq-mt-1" fullWidth size="lg" disabled={busy} onClick={submit}>
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
      <div className="bq-flex bq-items-center bq-gap-3 bq-mb-5">
        <div className="bq-stat-lg">Plans</div>
        <Button className="bq-ml-auto" onClick={openNew}>
          <Icon name="plus" size={18} /> New plan
        </Button>
      </div>

      {plansRes.error && <ErrorBanner text={plansRes.error} />}

      <SectionHeader count={plans.length}>SaaS plans</SectionHeader>
      <div className="bq-stack">
        {plans.map((p) => (
          <Card className="bq-ops-plans-card" pad="none" key={p.id}>
            <div className="bq-grow">
              <div className="bq-ops-plans-title">{p.name}</div>
              <div className="bq-ops-plans-meta">
                {egp(p.price)}/mo · {limitLabel(p.teamSizeLimit)} staff · {limitLabel(p.clientSizeLimit)} clients
              </div>
            </div>
            <button className="bq-hit bq-ops-plans-btn" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
              <Icon name="pencil" size={17} />
            </button>
            <button className="bq-hit bq-ops-plans-btn-2" onClick={() => setDeleting(p)} aria-label={`Delete ${p.name}`}>
              <Icon name="trash" size={17} />
            </button>
          </Card>
        ))}
        {plans.length === 0 && (
          <EmptyState icon="tag" title="No SaaS plans yet" body="A plan sets what a gym pays Bizqwik each month and its staff and client limits. Assign one to each org." action={{ label: "+ New plan", onClick: openNew }} />
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

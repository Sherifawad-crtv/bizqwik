import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet } from "../../../design-system/components/Sheet";
import { Button } from "../../../design-system/components/Button";
import { TextField, SelectField } from "../../../design-system/components/FormField";
import { slugify } from "../domain/ops";
import { useCreateOrg } from "./hooks/useOps";
import type { PlanType } from "../domain/types";
import { ErrorBanner } from "../../../design-system/components/ErrorBanner";
import "./CreateOrgSheet.css";

export function CreateOrgSheet({ open, onClose, plans, onCreated }: { open: boolean; onClose: () => void; plans: PlanType[]; onCreated: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [headName, setHeadName] = useState("");
  const [headEmail, setHeadEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const { create, busy, error, setError } = useCreateOrg();
  const [created, setCreated] = useState<{ id: string; name: string; slug: string; deptHeadEmail: string; domain: { name: string; connected: boolean; reason: string | null } | null } | null>(null);

  const reset = () => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setHeadName("");
    setHeadEmail("");
    setPlanId("");
    setError(null);
    setCreated(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const submit = async () => {
    const res = await create(name, effectiveSlug, headName, headEmail, planId);
    if (!res) return;
    // Keep the sheet open on a success step so the operator can jump straight
    // to the printable check-in QR; the list refreshes underneath.
    onCreated();
    setCreated({ id: res.org.id, name: res.org.name, slug: res.org.slug, deptHeadEmail: res.deptHeadEmail, domain: res.domain ?? null });
  };

  const planOptions = [{ value: "", label: "No plan (assign later)" }, ...plans.map((p) => ({ value: p.id, label: p.name }))];

  if (created) {
    return (
      <Sheet open={open} onClose={close}>
        <div className="bq-ops-create-org-sheet-label">ORGANIZATION CREATED</div>
        <div className="bq-ops-create-org-sheet-title">{created.name} is live</div>
        <div className="bq-ops-create-org-sheet-meta">
          Its department head signs up with <b>{created.deptHeadEmail}</b>. Two starter pay tiers were created. Next: print
          the front-desk check-in QR so members can start checking in.
        </div>
        {created.domain && !created.domain.connected && (
          <div className="bq-ops-create-org-sheet-text"
            data-testid="domain-warning"
          >
            <b>{created.domain.name}</b> couldn't be connected automatically
            {created.domain.reason ? ` (${created.domain.reason})` : ""}, so its member app has no https yet and the camera
            won't work there.
          </div>
        )}
        <Button
          fullWidth
          size="lg"
          onClick={() => {
            const id = created.id;
            close();
            navigate(`/bizqwik/orgs/${id}/qr`);
          }}
        >
          View &amp; print check-in QR
        </Button>
        <Button className="bq-mt-2" variant="quiet" fullWidth onClick={close}>
          Done
        </Button>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close}>
      <div className="bq-label">NEW ORGANIZATION</div>
      <div className="bq-title">Onboard a gym</div>
      <div className="bq-stack">
        <TextField label="ORGANIZATION NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Iron Athletics" />
        <TextField
          label="URL SLUG"
          value={effectiveSlug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          placeholder="iron-athletics"
        />
        <SelectField label="PLAN" value={planId} options={planOptions} onChange={setPlanId} placeholder="No plan (assign later)" />
        {plans.length === 0 && (
          <div className="bq-ops-create-org-sheet-meta-2">
            No SaaS plans yet — create them under Plans. You can assign one to this org later.
          </div>
        )}
        <TextField label="DEPARTMENT-HEAD NAME" value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder="Optional" />
        <TextField label="DEPARTMENT-HEAD EMAIL" type="email" value={headEmail} onChange={(e) => setHeadEmail(e.target.value)} placeholder="head@gym.com" />
        <div className="bq-ops-create-org-sheet-meta-2">
          They'll sign up with this email to claim the dept-head account. Two starter pay tiers are created automatically.
        </div>
        {error && <ErrorBanner text={error} />}
        <Button className="bq-mt-1" fullWidth size="lg" disabled={busy} onClick={submit}>
          {busy ? "Creating…" : "Create organization"}
        </Button>
      </div>
    </Sheet>
  );
}

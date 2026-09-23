import { useState } from "react";
import { Sheet } from "../../components/Sheet";
import { Button } from "../../components/Button";
import { TextField, SelectField } from "../../components/FormField";
import { api } from "../../lib/backend";
import type { PlanType } from "../../lib/types";
import { ErrorBanner } from "./shared";

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function CreateOrgSheet({ open, onClose, plans, onCreated }: { open: boolean; onClose: () => void; plans: PlanType[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [headName, setHeadName] = useState("");
  const [headEmail, setHeadEmail] = useState("");
  const [planId, setPlanId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setHeadName("");
    setHeadEmail("");
    setPlanId("");
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const submit = async () => {
    setError(null);
    if (!name.trim()) return setError("Organization name is required.");
    if (!effectiveSlug) return setError("A URL slug is required.");
    if (!headEmail.trim()) return setError("A department-head email is required.");
    setBusy(true);
    try {
      await api.ops.createOrg(name.trim(), effectiveSlug, headName.trim(), headEmail.trim(), planId || null);
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const planOptions = [{ value: "", label: "No plan (assign later)" }, ...plans.map((p) => ({ value: p.id, label: p.name }))];

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>NEW ORGANIZATION</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Onboard a gym</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
        <TextField label="DEPARTMENT-HEAD NAME" value={headName} onChange={(e) => setHeadName(e.target.value)} placeholder="Optional" />
        <TextField label="DEPARTMENT-HEAD EMAIL" type="email" value={headEmail} onChange={(e) => setHeadEmail(e.target.value)} placeholder="head@gym.com" />
        <div style={{ font: "500 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", padding: "0 2px" }}>
          They'll sign up with this email to claim the dept-head account. Two starter pay tiers are created automatically.
        </div>
        {error && <ErrorBanner text={error} />}
        <Button fullWidth size="lg" disabled={busy} onClick={submit} style={{ marginTop: 4 }}>
          {busy ? "Creating…" : "Create organization"}
        </Button>
      </div>
    </Sheet>
  );
}

import { useEffect, useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { TextField, SelectField } from "./FormField";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { canLog } from "../lib/types";
import type { Client } from "../lib/types";
import { fmt } from "../lib/format";

interface CoachOption {
  id: string;
  name: string;
}

const STEP_TITLES = ["New client", "Choose bundle", "Assign coach"];

function StepProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 18 }}>
      {([1, 2, 3] as const).map((n) => (
        <div key={n} style={{ display: "flex", alignItems: "center", flex: n < 3 ? 1 : "none" }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              flex: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: n <= step ? "var(--primary)" : "var(--sunken)",
              color: n <= step ? "var(--surface)" : "var(--ink-faint)",
              font: "700 12px var(--font-mono)",
              border: n <= step ? "none" : "1px solid var(--line)",
              transition: "background .2s ease, color .2s ease",
            }}
          >
            {n}
          </div>
          {n < 3 && (
            <div
              style={{
                flex: 1,
                height: 2,
                margin: "0 6px",
                background: n < step ? "var(--primary)" : "var(--line)",
                transition: "background .2s ease",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
      {text}
    </div>
  );
}

export function NewClientWizardSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [conditions, setConditions] = useState("");
  const [client, setClient] = useState<Client | null>(null);
  const [bundleTypeId, setBundleTypeId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: bundleData } = useAsync(() => (open ? api.bundleTypes() : Promise.resolve(null)), [open]);
  const { data: monthData } = useAsync(() => (open ? api.month(MOCK.CURRENT_MONTH) : Promise.resolve(null)), [open]);
  const bundleTypes = bundleData?.bundleTypes ?? [];
  const coachOptions: CoachOption[] = (monthData?.rows ?? []).filter((r) => canLog(r.role)).map((r) => ({ id: r.coachId, name: r.name }));

  useEffect(() => {
    if (open) {
      setStep(1);
      setName("");
      setAge("");
      setConditions("");
      setClient(null);
      setBundleTypeId("");
      setCoachId("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const createAndNext = async () => {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { client: created } = await api.createClient(name.trim(), age.trim() ? Number(age) : null, conditions.trim() || null);
      setClient(created);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const toStep3 = () => {
    if (!bundleTypeId) {
      setError("Choose a bundle.");
      return;
    }
    setError(null);
    setStep(3);
  };

  const finish = async () => {
    if (!client) return;
    if (!coachId) {
      setError("Choose a coach.");
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

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>STEP {step} OF 3</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{STEP_TITLES[step - 1]}</div>
      <StepProgress step={step} />

      {step === 1 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" />
            <TextField label="AGE (OPTIONAL)" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} />
            <TextField label="CONDITIONS (OPTIONAL)" value={conditions} onChange={(e) => setConditions(e.target.value)} placeholder="Only visible to their coach and heads" />
          </div>
          {error && <ErrorBanner text={error} />}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={createAndNext}>
            {busy ? "Creating…" : "Next: choose bundle"}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <SelectField
            label="BUNDLE"
            value={bundleTypeId}
            onChange={setBundleTypeId}
            placeholder="Choose a bundle"
            options={bundleTypes.map((b) => ({ value: b.id, label: `${b.name} · ${fmt(b.price)} EGP` }))}
          />
          {error && <ErrorBanner text={error} />}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={toStep3}>
            Next: assign coach
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose}>
            Cancel
          </Button>
        </>
      )}

      {step === 3 && (
        <>
          <SelectField
            label="COACH"
            value={coachId}
            onChange={setCoachId}
            placeholder="Choose a coach"
            options={coachOptions.map((c) => ({ value: c.id, label: c.name }))}
          />
          {error && <ErrorBanner text={error} />}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={finish}>
            {busy ? "Saving…" : "Create & sell package"}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={() => setStep(2)} disabled={busy}>
            Back
          </Button>
        </>
      )}
    </Sheet>
  );
}

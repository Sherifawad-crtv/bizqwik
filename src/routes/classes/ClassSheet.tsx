import { useState } from "react";
import { api } from "../../lib/backend";
import { todayIso } from "../../lib/format";
import type { GymClass } from "../../lib/types";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { TextField } from "../../components/FormField";
import { DateField } from "../../components/DateField";
import { TimeWheelField } from "../../components/TimeWheelField";
import { ClassPhotoField } from "../../components/ClassPhotoField";
import { LocationField, useLocations } from "../../lib/locations";
import { type FormState, emptyForm } from "./classForm";

export function ClassSheet({
  form,
  onClose,
  onSaved,
  onRequestCancel,
  solo,
}: {
  solo?: boolean;
  form: FormState | null;
  onClose: () => void;
  onSaved: () => void;
  onRequestCancel: (c: GymClass) => void;
}) {
  const [draft, setDraft] = useState<FormState>(emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seededId, setSeededId] = useState<string | null | undefined>(undefined);

  // Re-seed the local draft whenever a new form target opens (create vs a
  // specific class). `seededId === undefined` means "not yet seeded for this
  // open"; we key off the target's id so switching between classes reseeds.
  if (form && seededId !== (form.id ?? "__new__")) {
    setDraft(form);
    setSeededId(form.id ?? "__new__");
    setError(null);
  }
  if (!form && seededId !== undefined) setSeededId(undefined);

  const editing = draft.id !== null;
  const locations = useLocations();


  const save = async () => {
    setError(null);
    if (!draft.title.trim()) {
      setError("Give the class a title.");
      return;
    }
    const price = solo ? Number(draft.price) || 0 : Number(draft.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Price must be zero or more.");
      return;
    }
    if (locations.length > 0 && !draft.locationId) {
      setError("Choose the location.");
      return;
    }
    const startsAt = new Date(`${draft.date}T${draft.time}:00`).toISOString();
    const desc = draft.description.trim() || null;
    setBusy(true);
    try {
      if (draft.id) {
        await api.updateClass(draft.id, draft.title.trim(), desc, startsAt, price, draft.seriesId ? null : draft.imageUrl, locations.length > 0 ? draft.locationId : undefined);
      } else {
        await api.createClass(draft.title.trim(), desc, startsAt, price, draft.imageUrl, locations.length > 0 ? draft.locationId : undefined);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the class.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={form !== null} onClose={busy ? () => {} : onClose}>
      <div className="bq-label">{editing ? "THIS SESSION ONLY" : "ONE-OFF SESSION"}</div>
      <div className="bq-title">{editing ? "Edit session" : solo ? "New session" : "One-off session"}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TextField label="TITLE" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Sunrise HIIT" />
        {!solo && <TextField label="DESCRIPTION" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional — shown to members" />}
        {!solo && !draft.seriesId && <ClassPhotoField value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} title={draft.title} />}
        {solo && editing && (
          <div style={{ background: "var(--sunken)", borderRadius: "var(--r-input)", padding: "12px 14px" }}>
            <div className="bq-label">COMING · {draft.coming?.length ?? 0}</div>
            <div style={{ font: "600 var(--fs-body-sm)/1.5 var(--font-body)", marginTop: 4 }}>{draft.coming?.length ? draft.coming.join(", ") : "No one has said they're coming yet."}</div>
          </div>
        )}
        <LocationField locations={locations} value={draft.locationId} onChange={(id) => setDraft({ ...draft, locationId: id })} />
        <DateField value={draft.date} min={todayIso()} onChange={(iso) => setDraft({ ...draft, date: iso })} />
        <TimeWheelField label="TIME" value={draft.time} onChange={(v) => setDraft({ ...draft, time: v })} />
        {!solo && <TextField label="DROP-IN PRICE (EGP)" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} inputMode="numeric" placeholder="0 for free" />}
      </div>

      {error && (
        <div  className="bq-error bq-error--spaced bq-rise">{error}</div>
      )}

      <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
        {busy ? "Saving…" : editing ? "Save changes" : "Create session"}
      </Button>
      {editing && draft.id && (
        <Button
          variant="danger"
          fullWidth
          style={{ marginTop: 8 }}
          disabled={busy}
          onClick={() => onRequestCancel({ id: draft.id!, title: draft.title, description: draft.description || null, startsAt: new Date(`${draft.date}T${draft.time}:00`).toISOString(), price: Number(draft.price) || 0, status: "active" })}
        >
          Cancel this session
        </Button>
      )}
      <Button variant="quiet" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={onClose}>
        Close
      </Button>
    </Sheet>
  );
}

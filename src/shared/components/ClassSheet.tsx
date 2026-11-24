import { useState } from "react";
import { api } from "../api/backend";
import { todayIso } from "../format";
import type { GymClass } from "../types";
import { Button } from "../../design-system/components/Button";
import { Sheet } from "../../design-system/components/Sheet";
import { TextField } from "../../design-system/components/FormField";
import { DateField } from "../../design-system/components/DateField";
import { TimeWheelField } from "../../design-system/components/TimeWheelField";
import { ClassPhotoField } from "./ClassPhotoField";
import { LocationField, useLocations } from "../session/locations";
import { type FormState, emptyForm } from "../domain/classForm";
import "./ClassSheet.css";

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

      <div className="bq-flex bq-col bq-gap-3">
        <TextField label="TITLE" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Sunrise HIIT" />
        {!solo && <TextField label="DESCRIPTION" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional — shown to members" />}
        {!solo && !draft.seriesId && <ClassPhotoField value={draft.imageUrl} onChange={(url) => setDraft({ ...draft, imageUrl: url })} title={draft.title} />}
        {solo && editing && (
          <div className="bq-class-sheet-box">
            <div className="bq-label">COMING · {draft.coming?.length ?? 0}</div>
            <div className="bq-class-sheet-text">{draft.coming?.length ? draft.coming.join(", ") : "No one has said they're coming yet."}</div>
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

      <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>
        {busy ? "Saving…" : editing ? "Save changes" : "Create session"}
      </Button>
      {editing && draft.id && (
        <Button className="bq-mt-2"
          variant="danger"
          fullWidth
          disabled={busy}
          onClick={() => onRequestCancel({ id: draft.id!, title: draft.title, description: draft.description || null, startsAt: new Date(`${draft.date}T${draft.time}:00`).toISOString(), price: Number(draft.price) || 0, status: "active" })}
        >
          Cancel this session
        </Button>
      )}
      <Button className="bq-mt-2" variant="quiet" fullWidth disabled={busy} onClick={onClose}>
        Close
      </Button>
    </Sheet>
  );
}

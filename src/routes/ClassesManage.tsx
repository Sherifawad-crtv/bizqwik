import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/backend";
import { useAsync } from "../lib/useAsync";
import { useSetHeader } from "../lib/header";
import { egp, todayIso } from "../lib/format";
import type { GymClass } from "../lib/types";
import { Spinner } from "../components/Spinner";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { TextField, SelectField } from "../components/FormField";
import { DateField } from "../components/DateField";
import { ConfirmSheet } from "../components/ConfirmSheet";

const pad = (n: number) => String(n).padStart(2, "0");

function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const am = h < 12;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad(m)} ${am ? "AM" : "PM"}`;
}

// 30-min slots across a gym's plausible day. A custom sheet picker (not a
// native <input type=time>) — keeps the installed iOS PWA in standalone mode.
const TIME_OPTIONS = Array.from({ length: (22 - 6) * 2 + 1 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  const hhmm = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
  return { value: hhmm, label: timeLabel(hhmm) };
});

function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${date} · ${timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`;
}

interface FormState {
  id: string | null; // null = creating
  title: string;
  description: string;
  date: string;
  time: string;
  price: string;
}

function emptyForm(): FormState {
  return { id: null, title: "", description: "", date: todayIso(), time: "18:00", price: "" };
}

function formOf(c: GymClass): FormState {
  const d = new Date(c.startsAt);
  return {
    id: c.id,
    title: c.title,
    description: c.description ?? "",
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    price: String(c.price),
  };
}

export function ClassesManage() {
  const navigate = useNavigate();
  const classes = useAsync(() => api.classes(), []);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<GymClass | null>(null);
  useSetHeader({ kicker: "MEMBER APP", title: "Classes" }, []);

  const list = classes.data?.classes ?? [];
  const scheduled = list.filter((c) => c.status === "active");
  const cancelled = list.filter((c) => c.status === "cancelled");

  return (
    <div>
      <button
        onClick={() => navigate("/oversight")}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--ink-muted)", cursor: "pointer", font: "700 14px var(--font-body)", marginBottom: 14, padding: 0 }}
      >
        <Icon name="chevron-left" size={16} /> Oversight
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ font: "800 26px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>Classes</div>
          <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 4 }}>
            Scheduled classes members can book in the app.
          </div>
        </div>
        <Button onClick={() => setForm(emptyForm())} style={{ flex: "none" }}>
          <Icon name="plus" size={18} /> New class
        </Button>
      </div>

      {classes.loading && <Spinner />}
      {classes.error && (
        <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{classes.error}</div>
      )}

      {!classes.loading && list.length === 0 && (
        <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "34px 20px", textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
          No classes yet. Create one to make it bookable in the member app.
        </div>
      )}

      {scheduled.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {scheduled.map((c) => (
            <ClassCard key={c.id} c={c} onEdit={() => setForm(formOf(c))} />
          ))}
        </div>
      )}

      {cancelled.length > 0 && (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "24px 2px 10px" }}>
            CANCELLED · {cancelled.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cancelled.map((c) => (
              <ClassCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      <ClassSheet
        form={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          classes.refetch();
        }}
        onRequestCancel={(c) => {
          setForm(null);
          setConfirmCancel(c);
        }}
      />

      <ConfirmSheet
        open={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        kicker="MEMBER APP"
        title={`Cancel ${confirmCancel?.title ?? "class"}?`}
        sub="Members who paid from their wallet are refunded to wallet automatically. This can't be undone."
        confirmLabel="Cancel class"
        danger
        onConfirm={async () => {
          if (confirmCancel) await api.cancelClass(confirmCancel.id);
          setConfirmCancel(null);
          classes.refetch();
        }}
      />
    </div>
  );
}

function ClassCard({ c, onEdit }: { c: GymClass; onEdit?: () => void }) {
  const cancelled = c.status === "cancelled";
  return (
    <div
      data-sq
      onClick={onEdit}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-card)",
        padding: "14px 16px",
        cursor: onEdit ? "pointer" : "default",
        opacity: cancelled ? 0.55 : 1,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: cancelled ? "line-through" : "none" }}>{c.title}</div>
        <div style={{ font: "500 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 3 }}>{whenLabel(c.startsAt)}</div>
        {c.description && (
          <div style={{ font: "400 13px/1.4 var(--font-body)", color: "var(--ink-faint)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {c.description}
          </div>
        )}
      </div>
      <div style={{ flex: "none", textAlign: "right" }}>
        <div className="tabular" style={{ font: "800 16px var(--font-body)" }}>{c.price > 0 ? egp(c.price) : "Free"}</div>
        {onEdit && <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-faint)", marginTop: 4 }}>EDIT</div>}
      </div>
    </div>
  );
}

function ClassSheet({
  form,
  onClose,
  onSaved,
  onRequestCancel,
}: {
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

  const timeOptions = TIME_OPTIONS.some((o) => o.value === draft.time)
    ? TIME_OPTIONS
    : [{ value: draft.time, label: timeLabel(draft.time) }, ...TIME_OPTIONS];

  const save = async () => {
    setError(null);
    if (!draft.title.trim()) {
      setError("Give the class a title.");
      return;
    }
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Price must be zero or more.");
      return;
    }
    const startsAt = new Date(`${draft.date}T${draft.time}:00`).toISOString();
    const desc = draft.description.trim() || null;
    setBusy(true);
    try {
      if (draft.id) {
        await api.updateClass(draft.id, draft.title.trim(), desc, startsAt, price);
      } else {
        await api.createClass(draft.title.trim(), desc, startsAt, price);
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
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>MEMBER APP</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{editing ? "Edit class" : "New class"}</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TextField label="TITLE" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Sunrise HIIT" />
        <TextField label="DESCRIPTION" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Optional — shown to members" />
        <DateField value={draft.date} min={todayIso()} onChange={(iso) => setDraft({ ...draft, date: iso })} />
        <SelectField label="TIME" value={draft.time} options={timeOptions} onChange={(v) => setDraft({ ...draft, time: v })} />
        <TextField label="PRICE (EGP)" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} inputMode="numeric" placeholder="0 for free" />
      </div>

      {error && (
        <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>
      )}

      <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
        {busy ? "Saving…" : editing ? "Save changes" : "Create class"}
      </Button>
      {editing && draft.id && (
        <Button
          variant="danger"
          fullWidth
          style={{ marginTop: 8 }}
          disabled={busy}
          onClick={() => onRequestCancel({ id: draft.id!, title: draft.title, description: draft.description || null, startsAt: new Date(`${draft.date}T${draft.time}:00`).toISOString(), price: Number(draft.price) || 0, status: "active" })}
        >
          Cancel this class
        </Button>
      )}
      <Button variant="quiet" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={onClose}>
        Close
      </Button>
    </Sheet>
  );
}

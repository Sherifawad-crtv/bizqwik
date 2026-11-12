import { EmptyState } from "../../components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useLatch } from "../../lib/useLatch";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { api, MOCK } from "../../lib/backend";
import { fmt, monthAbbr } from "../../lib/format";
import type { ExpenseCategory, RecurringExpense } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { TextField, SelectField } from "../../components/FormField";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { Card as PlainCard, SectionTitle } from "../frontdesk/shared";
import { CategoriesSheet } from "./ExpenseSheet";
import { catOptions } from "./options";

function nextOccurrence(r: RecurringExpense): string | null {
  if (!r.active) return null;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, r.dayOfMonth);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (month < r.startMonth) continue;
    if (r.endMonth && month > r.endMonth) return null;
    const iso = d.toISOString().slice(0, 10);
    if (iso >= todayIso) return iso;
  }
  return null;
}

export function RecurringPanel({ categories, onChanged, onCategoriesChanged }: { categories: ExpenseCategory[]; onChanged: () => void; onCategoriesChanged: () => void }) {
  const { data, refetch } = useAsync(() => api.recurringExpenses(), []);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [managingCats, setManagingCats] = useState(false);
  const recurring = data?.recurring ?? [];

  return (
    <div>
      <SectionTitle count={recurring.length} right={<button onClick={() => setManagingCats(true)} style={{ border: 0, background: "none", font: "700 var(--fs-note) var(--font-body)", color: "var(--primary-pressed)", cursor: "pointer" }}>Categories</button>}>
        Recurring expenses
      </SectionTitle>
      <PlainCard style={{ overflow: "hidden", marginBottom: 14 }}>
        {recurring.map((r, i) => {
          const next = nextOccurrence(r);
          return (
            <button key={r.id} className="bq-scale" onClick={() => setEditing(r)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left", padding: "13px 18px", borderBottom: i === recurring.length - 1 ? "none" : "1px solid var(--line)", opacity: r.active ? 1 : 0.5 }}>
              <div className="bq-grow">
                <div style={{ font: "700 var(--fs-body) var(--font-body)" }}>{r.categoryName}{r.note ? ` · ${r.note}` : ""}</div>
                <div style={{ font: "400 var(--fs-small) var(--font-mono)", color: "var(--ink-faint)" }}>
                  Day {r.dayOfMonth} · {r.active ? (next ? `Next ${next.slice(8, 10)} ${monthAbbr(next.slice(0, 7))}` : "Ended") : "Paused"}
                </div>
              </div>
              <div className="tabular" style={{ flex: "none", font: "800 var(--fs-body) var(--font-mono)" }}>{fmt(r.amount)}</div>
              <Icon name="chevron-right" size={16} />
            </button>
          );
        })}
        {recurring.length === 0 && (
          <EmptyState bare icon="cash" title={data ? "No repeating expenses" : "Loading…"} body="Rent, salaries and anything else that happens every month — set it up once." />
        )}
      </PlainCard>
      <Button fullWidth size="lg" style={{ marginBottom: 18 }} onClick={() => setEditing({ id: "", categoryId: categories.find((c) => !c.archived)?.id ?? "", categoryName: "", amount: 0, note: null, dayOfMonth: new Date().getDate() > 28 ? 28 : new Date().getDate(), startMonth: MOCK.CURRENT_MONTH, endMonth: null, active: true })}>
        Add a repeating expense
      </Button>
      <RecurringSheet
        template={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          refetch();
          onChanged();
        }}
      />
      <CategoriesSheet open={managingCats} categories={categories} onClose={() => setManagingCats(false)} onChanged={onCategoriesChanged} />
    </div>
  );
}

function RecurringSheet({ template, categories, onClose, onSaved }: { template: RecurringExpense | null; categories: ExpenseCategory[]; onClose: () => void; onSaved: () => void }) {
  const shown = useLatch(template);
  const isNew = !shown?.id;
  const open = template !== null;
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [endMonth, setEndMonth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (!open || !shown) return;
    setAmount(shown.amount ? String(shown.amount) : "");
    setCategoryId(shown.categoryId);
    setNote(shown.note ?? "");
    setDayOfMonth(String(shown.dayOfMonth));
    setEndMonth(shown.endMonth ?? "");
    setError(null);
    // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shown?.id]);

  if (!shown) return null;

  const save = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter an amount.");
    if (!categoryId) return setError("Choose a category.");
    const day = Number(dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 28) return setError("Pick a day between 1 and 28.");
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await api.createRecurringExpense(categoryId, amt, day, note.trim() || undefined, endMonth || undefined);
      } else {
        await api.updateRecurringExpense(shown.id, { amount: amt, categoryId, note: note.trim(), dayOfMonth: day, endMonth: endMonth || null });
      }
      onSaved();
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  const togglePause = async () => {
    setBusy(true);
    try {
      await api.updateRecurringExpense(shown.id, { active: !shown.active });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={isNew ? "Repeating expense set up" : "Saved"} iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">{isNew ? "ADD REPEATING EXPENSE" : "EDIT TEMPLATE"}</div>
          <div className="bq-title">{isNew ? "Every month" : shown.categoryName}</div>
          <div className="bq-stack">
            <TextField label="AMOUNT (EGP)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
            <SelectField label="CATEGORY" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={catOptions(categories)} />
            <TextField label="DAY OF MONTH (1–28)" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} inputMode="numeric" />
            <TextField label="NOTE (OPTIONAL)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it's for" />
            <TextField label="ENDS (OPTIONAL, YYYY-MM)" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} placeholder="Leave blank to repeat forever" />
          </div>
          <div style={{ marginTop: 8, font: "400 var(--fs-small)/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
            {isNew ? "Changing this later only affects future months — rows already made stay as they are." : "Editing changes future months only. Rows already made for past months are untouched."}
          </div>
          {error && <div  className="bq-error bq-error--spaced bq-rise">{error}</div>}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
            {busy ? "Saving…" : isNew ? "Set up repeating expense" : "Save changes"}
          </Button>
          {!isNew && (
            <>
              <Button variant="secondary" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={togglePause}>
                {shown.active ? "Pause" : "Resume"}
              </Button>
              <Button variant="danger" fullWidth style={{ marginTop: 8 }} onClick={() => setConfirmingDelete(true)}>
                Delete template
              </Button>
              <ConfirmSheet
                open={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
                kicker="DELETE TEMPLATE"
                title="Delete this template?"
                sub="Expenses it already created stay — this just stops making new ones."
                confirmLabel="Delete"
                danger
                onConfirm={async () => {
                  await api.deleteRecurringExpense(shown.id);
                  onSaved();
                  onClose();
                }}
              />
            </>
          )}
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

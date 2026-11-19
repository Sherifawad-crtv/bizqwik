import { cx } from "../../design-system/cx";
import { EmptyState } from "../../design-system/components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../shared/api/useAsync";
import { useLatch } from "../../shared/useLatch";
import { useSheetSuccess } from "../../design-system/components/useSheetSuccess";
import { api, MOCK } from "../../shared/api/backend";
import { fmt, monthAbbr } from "../../shared/format";
import type { ExpenseCategory, RecurringExpense } from "../../shared/types";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Sheet } from "../../design-system/components/Sheet";
import { ConfirmSheet } from "../../design-system/components/ConfirmSheet";
import { TextField, SelectField } from "../../design-system/components/FormField";
import { SheetSuccessIcon } from "../../design-system/components/SheetSuccessIcon";
import { Card } from "../../design-system/components/Card";
import { SectionHeader } from "../../design-system/components/SectionHeader";
import { CategoriesSheet } from "./ExpenseSheet";
import { catOptions } from "./options";
import { MotionList } from "../../design-system/components/MotionList";
import "./Recurring.css";

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
      <SectionHeader count={recurring.length} right={<button className="bq-accounting-recurring-panel-btn" onClick={() => setManagingCats(true)}>Categories</button>}>
        Recurring expenses
      </SectionHeader>
      <Card className="bq-overflow-hidden bq-mb-4" pad="none">
        <MotionList>
{recurring.map((r, i) => {
          const next = nextOccurrence(r);
          return (
            <button key={r.id} className={cx(`bq-plain bq-scale bq-listrow bq-listrow--compact ${!(i === recurring.length - 1) ? "bq-listrow--divider" : ""}`, "bq-accounting-recurring-panel-btn-2")} onClick={() => setEditing(r)} style={{ opacity: r.active ? 1 : 0.5 }}>
              <div className="bq-grow">
                <div className="bq-accounting-recurring-panel-title">{r.categoryName}{r.note ? ` · ${r.note}` : ""}</div>
                <div className="bq-accounting-recurring-panel-meta">
                  Day {r.dayOfMonth} · {r.active ? (next ? `Next ${next.slice(8, 10)} ${monthAbbr(next.slice(0, 7))}` : "Ended") : "Paused"}
                </div>
              </div>
              <div className="tabular bq-accounting-recurring-panel-meta-2">{fmt(r.amount)}</div>
              <Icon name="chevron-right" size={16} />
            </button>
          );
        })}
</MotionList>
        {recurring.length === 0 && (
          <EmptyState bare icon="cash" title={data ? "No repeating expenses" : "Loading…"} body="Rent, salaries and anything else that happens every month — set it up once." />
        )}
      </Card>
      <Button className="bq-mb-4" fullWidth size="lg" onClick={() => setEditing({ id: "", categoryId: categories.find((c) => !c.archived)?.id ?? "", categoryName: "", amount: 0, note: null, dayOfMonth: new Date().getDate() > 28 ? 28 : new Date().getDate(), startMonth: MOCK.CURRENT_MONTH, endMonth: null, active: true })}>
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
          <div className="bq-accounting-recurring-sheet-meta">
            {isNew ? "Changing this later only affects future months — rows already made stay as they are." : "Editing changes future months only. Rows already made for past months are untouched."}
          </div>
          {error && <div  className="bq-error bq-error--spaced bq-rise">{error}</div>}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>
            {busy ? "Saving…" : isNew ? "Set up repeating expense" : "Save changes"}
          </Button>
          {!isNew && (
            <>
              <Button className="bq-mt-2" variant="secondary" fullWidth disabled={busy} onClick={togglePause}>
                {shown.active ? "Pause" : "Resume"}
              </Button>
              <Button className="bq-mt-2" variant="danger" fullWidth onClick={() => setConfirmingDelete(true)}>
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
          <Button className="bq-mt-2" variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

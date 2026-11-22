import { cx } from "../../../design-system/cx";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { useEffect, useState } from "react";
import { useLatch } from "../../../shared/useLatch";
import { useSheetSuccess } from "../../../design-system/components/useSheetSuccess";
import { fmt, monthAbbr } from "../../../shared/format";
import type { ExpenseCategory, RecurringExpense } from "../../../shared/types";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { Sheet } from "../../../design-system/components/Sheet";
import { ConfirmSheet } from "../../../design-system/components/ConfirmSheet";
import { TextField, SelectField } from "../../../design-system/components/FormField";
import { SheetSuccessIcon } from "../../../design-system/components/SheetSuccessIcon";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { CategoriesSheet } from "./ExpenseSheet";
import { catOptions } from "./options";
import { MotionList } from "../../../design-system/components/MotionList";
import { newRecurringTemplate, nextOccurrence } from "../domain/accounting";
import { CURRENT_MONTH, useRecurring } from "./hooks/useAccounting";
import { useRecurringActions } from "./hooks/useAccountingActions";
import "./Recurring.css";

export function RecurringPanel({ categories, onChanged, onCategoriesChanged }: { categories: ExpenseCategory[]; onChanged: () => void; onCategoriesChanged: () => void }) {
  const { loaded, recurring, refetch } = useRecurring();
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [managingCats, setManagingCats] = useState(false);

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
          <EmptyState bare icon="cash" title={loaded ? "No repeating expenses" : "Loading…"} body="Rent, salaries and anything else that happens every month — set it up once." />
        )}
      </Card>
      <Button className="bq-mb-4" fullWidth size="lg" onClick={() => setEditing(newRecurringTemplate(categories, CURRENT_MONTH))}>
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
  const { save: saveTemplate, togglePause: pauseOrResume, remove, busy, error, setError } = useRecurringActions();
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
    if (await saveTemplate(shown, { amount, categoryId, note, dayOfMonth, endMonth })) {
      onSaved();
      showSuccess();
    }
  };
  const togglePause = async () => {
    await pauseOrResume(shown);
    onSaved();
    onClose();
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
                  await remove(shown.id);
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

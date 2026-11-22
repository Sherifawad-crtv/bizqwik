import { SwitchVisual } from "../../../design-system/components/Switch";
import { Reveal } from "../../../design-system/components/Reveal";
import { useEffect, useRef, useState } from "react";
import { useLatch } from "../../../shared/useLatch";
import { useSheetSuccess } from "../../../design-system/components/useSheetSuccess";
import { receiptDataUrl } from "../../../shared/image";
import type { Expense, ExpenseCategory } from "../../../shared/types";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { Sheet } from "../../../design-system/components/Sheet";
import { ConfirmSheet } from "../../../design-system/components/ConfirmSheet";
import { TextField, SelectField } from "../../../design-system/components/FormField";
import { DateField } from "../../../design-system/components/DateField";
import { SheetSuccessIcon } from "../../../design-system/components/SheetSuccessIcon";
import { catOptions } from "./options";
import { defaultCategoryId, defaultDayOfMonth } from "../domain/accounting";
import { CURRENT_MONTH } from "./hooks/useAccounting";
import { useCategoryActions, useExpenseActions } from "./hooks/useAccountingActions";
import "./ExpenseSheet.css";

/** Add or edit one expense: amount, category, date (today by default), note,
 * an optional receipt photo, and — add mode only — "repeat monthly", which
 * creates a template instead of (or alongside) this one-off row. Everything
 * after the amount has a sensible default, so a quick add is a handful of
 * taps: open, type the number, confirm. */
export function ExpenseSheet({
  mode,
  categories,
  onClose,
  onSaved,
}: {
  mode: "add" | Expense | null;
  categories: ExpenseCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const shown = useLatch(mode);
  const editing = shown && shown !== "add" ? shown : null;
  const open = mode !== null;
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(CURRENT_MONTH + "-01");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const { save: saveExpense, busy, error, setError } = useExpenseActions();
  const amountInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (!open) return;
    const todayIso = new Date().toISOString().slice(0, 10);
    if (editing) {
      setAmount(String(editing.amount));
      setCategoryId(editing.categoryId);
      setDate(editing.date);
      setNote(editing.note ?? "");
    } else {
      setAmount("");
      setCategoryId(defaultCategoryId(categories));
      setDate(todayIso);
      setNote("");
      setRepeat(false);
      setDayOfMonth(String(defaultDayOfMonth(new Date())));
    }
    setReceipt(null);
    setError(null);
    window.setTimeout(() => amountInput.current?.focus(), 50);
    // Deliberate: Reset the form only when the sheet opens or its subject changes; re-running on every prop change would wipe what's being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  if (!shown) return null;

  const onPickReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setReceipt(await receiptDataUrl(file));
    } catch {
      setError("Couldn't read that photo. Try again.");
    }
  };

  const save = async () => {
    if (await saveExpense(editing, { amount, categoryId, date, note, receipt, repeat, dayOfMonth })) {
      onSaved();
      showSuccess();
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={editing ? "Expense updated" : repeat ? "Repeating expense set up" : "Expense added"} iconIn={iconIn} />
      ) : (
        <>
          <div className="bq-label">{editing ? "EDIT EXPENSE" : "ADD EXPENSE"}</div>
          <div className="bq-title">
            {editing ? editing.categoryName : "What did the business spend on?"}
          </div>
          <div className="bq-stack">
            <label className="bq-accounting-expense-sheet-label">
              <span className="bq-label">AMOUNT (EGP)</span>
              <input className="bq-accounting-expense-sheet-input"
                ref={amountInput}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
              />
            </label>
            <SelectField label="CATEGORY" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={catOptions(categories)} />
            {(!repeat || editing) && <DateField value={date} onChange={setDate} />}
            <TextField label="NOTE (OPTIONAL)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it was for" />

            {!editing && (
              <>
                <input className="bq-accounting-expense-sheet-input-2" ref={fileInput} type="file" accept="image/*" capture="environment" onChange={onPickReceipt} data-testid="receipt-input" />
                <button className="bq-accounting-expense-sheet-btn"
                  onClick={() => fileInput.current?.click()}
                >
                  <Icon name="card" size={18} className="bq-fg-tertiary" />
                  <span className="bq-accounting-expense-sheet-text">{receipt ? "Receipt attached" : "Attach a receipt photo (optional)"}</span>
                </button>
              </>
            )}

            {!editing && (
              <button className="bq-accounting-expense-sheet-btn-2"
                type="button"
                role="switch"
                aria-checked={repeat}
                onClick={() => setRepeat(!repeat)}
              >
                <span className="bq-accounting-expense-sheet-text-2">Repeat monthly</span>
                <SwitchVisual checked={repeat} />
              </button>
            )}
            {!editing && (
              <Reveal show={repeat} gap={10}>
                <TextField label="DAY OF MONTH (1–28)" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} inputMode="numeric" />
              </Reveal>
            )}
          </div>
          {error && (
            <div  className="bq-error bq-error--spaced bq-rise">{error}</div>
          )}
          <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={save}>
            {busy ? "Saving…" : editing ? "Save changes" : repeat ? "Set up repeating expense" : "Add expense"}
          </Button>
          {editing && (
            <DeleteExpenseButton id={editing.id} onDeleted={() => { onSaved(); onClose(); }} />
          )}
          <Button className="bq-mt-2" variant="secondary" fullWidth onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

function DeleteExpenseButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { remove } = useExpenseActions();
  return (
    <>
      <Button className="bq-mt-2" variant="danger" fullWidth onClick={() => setConfirming(true)}>
        Delete expense
      </Button>
      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        kicker="DELETE EXPENSE"
        title="Delete this expense?"
        sub="This can't be undone."
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await remove(id);
          onDeleted();
        }}
      />
    </>
  );
}

export function CategoriesSheet({ open, categories, onClose, onChanged }: { open: boolean; categories: ExpenseCategory[]; onClose: () => void; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const { add: addCategory, archive, busy, error } = useCategoryActions();

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    if (await addCategory(n)) {
      setName("");
      setAdding(false);
      onChanged();
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="bq-accounting-expense-sheet-categories-sheet-title">Expense categories</div>
      <div className="bq-flex bq-col bq-gap-2">
        {categories.map((c) => (
          <div className="bq-accounting-expense-sheet-categories-sheet-row" key={c.id}>
            <span className="bq-accounting-expense-sheet-categories-sheet-text">{c.name}</span>
            {!c.isDefault && (
              <button className="bq-accounting-expense-sheet-categories-sheet-btn"
                onClick={() => archive(c.id).then(onChanged)}
              >
                ARCHIVE
              </button>
            )}
          </div>
        ))}
      </div>
      {adding ? (
        <div className="bq-mt-3">
          <TextField label="NEW CATEGORY" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Insurance" />
          {error && <div className="bq-accounting-expense-sheet-categories-sheet-text-2">{error}</div>}
          <Button className="bq-mt-2" fullWidth disabled={busy} onClick={add}>{busy ? "Adding…" : "Add category"}</Button>
        </div>
      ) : (
        <Button className="bq-mt-3" variant="secondary" fullWidth onClick={() => setAdding(true)}>+ New category</Button>
      )}
      <Button className="bq-mt-2" variant="quiet" fullWidth onClick={onClose}>Close</Button>
    </Sheet>
  );
}

// ---- Recurring ----------------------------------------------------------

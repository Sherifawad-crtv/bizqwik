import { SwitchVisual } from "../../components/Switch";
import { Reveal } from "../../components/Reveal";
import { useEffect, useRef, useState } from "react";
import { useLatch } from "../../lib/useLatch";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { api, MOCK } from "../../lib/backend";
import { receiptDataUrl } from "../../lib/image";
import type { Expense, ExpenseCategory } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { TextField, SelectField } from "../../components/FormField";
import { DateField } from "../../components/DateField";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { catOptions } from "./options";

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
  const [date, setDate] = useState(MOCK.CURRENT_MONTH + "-01");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setCategoryId(categories.find((c) => !c.archived)?.id ?? "");
      setDate(todayIso);
      setNote("");
      setRepeat(false);
      setDayOfMonth(String(Math.min(28, new Date().getDate())));
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
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter an amount.");
    if (!categoryId) return setError("Choose a category.");
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await api.updateExpense(editing.id, { categoryId, amount: amt, date, note: note.trim() });
      } else if (repeat) {
        await api.createRecurringExpense(categoryId, amt, Number(dayOfMonth), note.trim() || undefined);
      } else {
        await api.addExpense(categoryId, amt, date, note.trim() || undefined, receipt ?? undefined);
      }
      onSaved();
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
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
            <label style={{ display: "block", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px" }}>
              <span className="bq-label">AMOUNT (EGP)</span>
              <input
                ref={amountInput}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                style={{ display: "block", width: "100%", border: 0, background: "none", outline: "none", font: "800 28px var(--font-body)", color: "var(--ink)", padding: "2px 0 0" }}
              />
            </label>
            <SelectField label="CATEGORY" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={catOptions(categories)} />
            {(!repeat || editing) && <DateField value={date} onChange={setDate} />}
            <TextField label="NOTE (OPTIONAL)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it was for" />

            {!editing && (
              <>
                <input ref={fileInput} type="file" accept="image/*" capture="environment" onChange={onPickReceipt} style={{ display: "none" }} data-testid="receipt-input" />
                <button
                  onClick={() => fileInput.current?.click()}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px", cursor: "pointer" }}
                >
                  <Icon name="card" size={18} style={{ color: "var(--ink-faint)" }} />
                  <span style={{ font: "600 var(--fs-body-sm) var(--font-body)" }}>{receipt ? "Receipt attached" : "Attach a receipt photo (optional)"}</span>
                </button>
              </>
            )}

            {!editing && (
              <button
                type="button"
                role="switch"
                aria-checked={repeat}
                onClick={() => setRepeat(!repeat)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px", cursor: "pointer", color: "var(--ink)" }}
              >
                <span style={{ flex: 1, font: "600 var(--fs-body-sm) var(--font-body)" }}>Repeat monthly</span>
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
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
            {busy ? "Saving…" : editing ? "Save changes" : repeat ? "Set up repeating expense" : "Add expense"}
          </Button>
          {editing && (
            <DeleteExpenseButton id={editing.id} onDeleted={() => { onSaved(); onClose(); }} />
          )}
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

function DeleteExpenseButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      <Button variant="danger" fullWidth style={{ marginTop: 8 }} onClick={() => setConfirming(true)}>
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
          await api.deleteExpense(id);
          onDeleted();
        }}
      />
    </>
  );
}

export function CategoriesSheet({ open, categories, onClose, onChanged }: { open: boolean; categories: ExpenseCategory[]; onClose: () => void; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      await api.createExpenseCategory(n);
      setName("");
      setAdding(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "800 var(--fs-title)/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "0 0 16px" }}>Expense categories</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {categories.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 14px" }}>
            <span style={{ flex: 1, font: "600 var(--fs-body) var(--font-body)" }}>{c.name}</span>
            {!c.isDefault && (
              <button
                onClick={() => api.setExpenseCategoryArchived(c.id, true).then(onChanged)}
                style={{ border: 0, background: "none", color: "var(--danger-fg)", font: "700 var(--fs-small) var(--font-mono)", cursor: "pointer" }}
              >
                ARCHIVE
              </button>
            )}
          </div>
        ))}
      </div>
      {adding ? (
        <div style={{ marginTop: 12 }}>
          <TextField label="NEW CATEGORY" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Insurance" />
          {error && <div style={{ marginTop: 8, font: "600 var(--fs-note) var(--font-body)", color: "var(--danger-fg)" }}>{error}</div>}
          <Button fullWidth style={{ marginTop: 10 }} disabled={busy} onClick={add}>{busy ? "Adding…" : "Add category"}</Button>
        </div>
      ) : (
        <Button variant="secondary" fullWidth style={{ marginTop: 12 }} onClick={() => setAdding(true)}>+ New category</Button>
      )}
      <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose}>Close</Button>
    </Sheet>
  );
}

// ---- Recurring ----------------------------------------------------------

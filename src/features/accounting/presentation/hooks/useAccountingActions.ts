import { useSave } from "../../../../shared/api/useSave";
import type { Expense, RecurringExpense } from "../../../../shared/types";
import { accountingRepository as repo } from "../../data/accountingRepository";
import { checkExpense, checkRecurring } from "../../domain/accounting";

export interface ExpenseForm {
  amount: string;
  categoryId: string;
  date: string;
  note: string;
  receipt: string | null;
  repeat: boolean;
  dayOfMonth: string;
}

/** Add, edit (or turn into a repeating template) and delete one-off expenses. */
export function useExpenseActions() {
  const { busy, error, setError, run } = useSave();
  const save = async (editing: Expense | null, f: ExpenseForm): Promise<boolean> => {
    const checked = checkExpense(f.amount, f.categoryId);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    const amount = checked.value.amount;
    return run(() => {
      if (editing) return repo.updateExpense(editing.id, { categoryId: f.categoryId, amount, date: f.date, note: f.note.trim() });
      if (f.repeat) return repo.createRecurring(f.categoryId, amount, Number(f.dayOfMonth), f.note.trim() || undefined);
      return repo.addExpense(f.categoryId, amount, f.date, f.note.trim() || undefined, f.receipt ?? undefined);
    });
  };
  return { save, busy, error, setError, remove: (id: string) => repo.deleteExpense(id) };
}

export interface RecurringForm {
  amount: string;
  categoryId: string;
  note: string;
  dayOfMonth: string;
  endMonth: string;
}

/** Create, edit, pause/resume and delete recurring templates. */
export function useRecurringActions() {
  const { busy, error, setError, run } = useSave();
  const save = async (template: RecurringExpense, f: RecurringForm): Promise<boolean> => {
    const checked = checkRecurring(f.amount, f.categoryId, f.dayOfMonth);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    const { amount, day } = checked.value;
    return run(() =>
      template.id
        ? repo.updateRecurring(template.id, { amount, categoryId: f.categoryId, note: f.note.trim(), dayOfMonth: day, endMonth: f.endMonth || null })
        : repo.createRecurring(f.categoryId, amount, day, f.note.trim() || undefined, f.endMonth || undefined),
    );
  };
  // Pausing shows no error message: a failure propagates, as before.
  const togglePause = (template: RecurringExpense) => run(() => repo.updateRecurring(template.id, { active: !template.active }), { rethrow: true });
  return { save, togglePause, busy, error, setError, remove: (id: string) => repo.deleteRecurring(id) };
}

/** Add and archive expense categories. */
export function useCategoryActions() {
  const { busy, error, run } = useSave();
  return {
    busy,
    error,
    add: (name: string) => run(() => repo.createCategory(name)),
    archive: (id: string) => repo.setCategoryArchived(id, true),
  };
}

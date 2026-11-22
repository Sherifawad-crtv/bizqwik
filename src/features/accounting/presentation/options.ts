import type { ExpenseCategory } from "../../../shared/types";

import { activeCategories } from "../domain/accounting";

/** Category choices for a select field. */
export const catOptions = (cats: ExpenseCategory[]) => activeCategories(cats).map((c) => ({ value: c.id, label: c.name }));

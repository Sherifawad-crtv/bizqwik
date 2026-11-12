import type { ExpenseCategory } from "../../lib/types";

export const catOptions = (cats: ExpenseCategory[]) => cats.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }));

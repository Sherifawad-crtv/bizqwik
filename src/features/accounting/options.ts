import type { ExpenseCategory } from "../../shared/types";

export const catOptions = (cats: ExpenseCategory[]) => cats.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }));

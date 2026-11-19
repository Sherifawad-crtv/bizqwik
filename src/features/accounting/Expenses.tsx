import { cx } from "../../design-system/cx";
import { EmptyState } from "../../design-system/components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../shared/api/useAsync";
import { api } from "../../shared/api/backend";
import { fmt, monthAbbr } from "../../shared/format";
import type { Expense, ExpenseCategory } from "../../shared/types";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { Card } from "../../design-system/components/Card";
import { SectionHeader } from "../../design-system/components/SectionHeader";
import { CategoriesSheet, ExpenseSheet } from "./ExpenseSheet";
import { MotionList } from "../../design-system/components/MotionList";
import { Chip } from "../../design-system/components/Chip";
import "./Expenses.css";

function ReceiptIcon({ has }: { has: boolean }) {
  if (!has) return null;
  return (
    <span className="bq-fg-tertiary bq-flex bq-flex-none">
      <Icon name="card" size={14} />
    </span>
  );
}

export function ExpensesPanel({
  month,
  categories,
  coachPayouts,
  openAdd,
  onAddHandled,
  onCoachPayouts,
  onChanged,
  onCategoriesChanged,
}: {
  month: string;
  categories: ExpenseCategory[];
  coachPayouts: number;
  openAdd: boolean;
  onAddHandled: () => void;
  onCoachPayouts: () => void;
  onChanged: () => void;
  onCategoriesChanged: () => void;
}) {
  const { data, refetch } = useAsync(() => api.expenses(month), [month]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sheetMode, setSheetMode] = useState<"add" | Expense | null>(null);
  const [managingCats, setManagingCats] = useState(false);

  useEffect(() => {
    if (openAdd) {
      setSheetMode("add");
      onAddHandled();
    }
  }, [openAdd, onAddHandled]);

  const expenses = (data?.expenses ?? []).filter(
    (e) => (!categoryFilter || e.categoryId === categoryFilter) && (!query.trim() || (e.note ?? "").toLowerCase().includes(query.trim().toLowerCase())),
  );
  const total = expenses.reduce((a, e) => a + e.amount, 0);

  return (
    <div>
      <div className="bq-flex bq-gap-2 bq-mb-3">
        <label className="bq-accounting-expenses-panel-label">
          <span className="bq-fg-tertiary bq-flex"><Icon name="search" size={18} /></span>
          <input className="bq-accounting-expenses-panel-input"
            aria-label="Search expense notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
          />
        </label>
      </div>
      <div className="bq-accounting-expenses-panel-row">
        <Chip size="sm" on={categoryFilter === ""} onClick={() => setCategoryFilter("")}>All</Chip>
        {categories.map((c) => (
          <Chip size="sm" key={c.id} on={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)}>{c.name}</Chip>
        ))}
      </div>

      <SectionHeader count={fmt(total) + " EGP"} right={<button className="bq-accounting-expenses-panel-btn" onClick={() => setManagingCats(true)}>Categories</button>}>
        Expenses
      </SectionHeader>

      <Card className="bq-overflow-hidden bq-mb-14px" pad="none">
        {coachPayouts > 0 && !categoryFilter && !query && (
          <button className="bq-plain bq-scale bq-listrow bq-listrow--compact bq-listrow--divider bq-accounting-expenses-panel-btn-2" onClick={onCoachPayouts}>
            <div className="bq-grow">
              <div className="bq-accounting-expenses-panel-title">Coach payouts</div>
              <div className="bq-accounting-expenses-panel-meta">Settled this month · locked</div>
            </div>
            <div className="tabular bq-accounting-expenses-panel-meta-2">{fmt(coachPayouts)}</div>
            <Icon name="chevron-right" size={16} />
          </button>
        )}
        <MotionList>
{expenses.map((e, i) => (
          <button key={e.id} className={cx(`bq-plain bq-scale bq-listrow bq-listrow--compact ${!(i === expenses.length - 1) ? "bq-listrow--divider" : ""}`, "bq-accounting-expenses-panel-btn-3")} onClick={() => setSheetMode(e)}>
            <div className="bq-grow">
              <div className="bq-flex bq-items-center bq-gap-6px">
                <span className="bq-accounting-expenses-panel-title-2">{e.categoryName}</span>
                <ReceiptIcon has={e.hasReceipt} />
              </div>
              <div className="bq-accounting-expenses-panel-meta-3">
                {e.date.slice(8, 10)} {monthAbbr(e.date.slice(0, 7))}{e.note ? ` · ${e.note}` : ""}{e.editedAfterMonthEnd ? " · edited after month end" : ""}
              </div>
            </div>
            <div className="tabular bq-accounting-expenses-panel-meta-2">{fmt(e.amount)}</div>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
</MotionList>
        {expenses.length === 0 && coachPayouts === 0 && (
          <EmptyState bare icon="cash" title={data ? "No expenses this month" : "Loading…"} body="Rent, salaries, utilities — whatever the business spent on. Add the first one below." />
        )}
      </Card>

      {!sheetMode && (
        <Button className="bq-mb-18px" fullWidth size="lg" onClick={() => setSheetMode("add")}>
          Add expense
        </Button>
      )}

      <ExpenseSheet
        mode={sheetMode}
        categories={categories}
        onClose={() => setSheetMode(null)}
        onSaved={() => {
          refetch();
          onChanged();
        }}
      />
      <CategoriesSheet open={managingCats} categories={categories} onClose={() => setManagingCats(false)} onChanged={onCategoriesChanged} />
    </div>
  );
}


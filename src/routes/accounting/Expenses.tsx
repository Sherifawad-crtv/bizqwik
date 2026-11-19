import { EmptyState } from "../../components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import { fmt, monthAbbr } from "../../lib/format";
import type { Expense, ExpenseCategory } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Card } from "../../components/Card";
import { SectionHeader } from "../../components/SectionHeader";
import { CategoriesSheet, ExpenseSheet } from "./ExpenseSheet";
import { MotionList } from "../../components/MotionList";
import { Chip } from "../../components/Chip";

function ReceiptIcon({ has }: { has: boolean }) {
  if (!has) return null;
  return (
    <span style={{ color: "var(--color-text-tertiary-default)", display: "flex", flex: "none" }}>
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
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <label style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 14px", background: "var(--color-bg-surface-secondary-default)", border: "1px solid var(--color-border-primary-default)", borderRadius: "var(--radius-item)" }}>
          <span style={{ color: "var(--color-text-tertiary-default)", display: "flex" }}><Icon name="search" size={18} /></span>
          <input
            aria-label="Search expense notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            style={{ flex: 1, minWidth: 0, border: 0, background: "none", outline: "none", font: "600 var(--text-callout-size) var(--font-family-body)", color: "var(--color-text-primary-default)" }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
        <Chip size="sm" on={categoryFilter === ""} onClick={() => setCategoryFilter("")}>All</Chip>
        {categories.map((c) => (
          <Chip size="sm" key={c.id} on={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)}>{c.name}</Chip>
        ))}
      </div>

      <SectionHeader count={fmt(total) + " EGP"} right={<button onClick={() => setManagingCats(true)} style={{ border: 0, background: "none", font: "700 var(--text-footnote-size) var(--font-family-body)", color: "var(--color-bg-fill-primary-active)", cursor: "pointer" }}>Categories</button>}>
        Expenses
      </SectionHeader>

      <Card pad="none" style={{ overflow: "hidden", marginBottom: 14 }}>
        {coachPayouts > 0 && !categoryFilter && !query && (
          <button className="bq-plain bq-scale bq-listrow bq-listrow--compact bq-listrow--divider" onClick={onCoachPayouts} style={{ width: "100%", background: "var(--color-bg-surface-secondary-default)", cursor: "pointer", textAlign: "left" }}>
            <div className="bq-grow">
              <div style={{ font: "700 var(--text-body-size) var(--font-family-body)" }}>Coach payouts</div>
              <div style={{ font: "400 var(--text-caption-1-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>Settled this month · locked</div>
            </div>
            <div className="tabular" style={{ flex: "none", font: "800 var(--text-body-size) var(--font-family-mono)" }}>{fmt(coachPayouts)}</div>
            <Icon name="chevron-right" size={16} />
          </button>
        )}
        <MotionList>
{expenses.map((e, i) => (
          <button key={e.id} className={`bq-plain bq-scale bq-listrow bq-listrow--compact ${!(i === expenses.length - 1) ? "bq-listrow--divider" : ""}`} onClick={() => setSheetMode(e)} style={{ width: "100%", background: "none", cursor: "pointer", textAlign: "left" }}>
            <div className="bq-grow">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ font: "700 var(--text-body-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.categoryName}</span>
                <ReceiptIcon has={e.hasReceipt} />
              </div>
              <div style={{ font: "400 var(--text-caption-1-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.date.slice(8, 10)} {monthAbbr(e.date.slice(0, 7))}{e.note ? ` · ${e.note}` : ""}{e.editedAfterMonthEnd ? " · edited after month end" : ""}
              </div>
            </div>
            <div className="tabular" style={{ flex: "none", font: "800 var(--text-body-size) var(--font-family-mono)" }}>{fmt(e.amount)}</div>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
</MotionList>
        {expenses.length === 0 && coachPayouts === 0 && (
          <EmptyState bare icon="cash" title={data ? "No expenses this month" : "Loading…"} body="Rent, salaries, utilities — whatever the business spent on. Add the first one below." />
        )}
      </Card>

      {!sheetMode && (
        <Button fullWidth size="lg" style={{ marginBottom: 18 }} onClick={() => setSheetMode("add")}>
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


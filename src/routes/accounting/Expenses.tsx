import { EmptyState } from "../../components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import { fmt, monthAbbr } from "../../lib/format";
import type { Expense, ExpenseCategory } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Card as PlainCard, SectionTitle } from "../frontdesk/shared";
import { CategoriesSheet, ExpenseSheet } from "./ExpenseSheet";

function ReceiptIcon({ has }: { has: boolean }) {
  if (!has) return null;
  return (
    <span style={{ color: "var(--ink-faint)", display: "flex", flex: "none" }}>
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
        <label style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 14px", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)" }}>
          <span style={{ color: "var(--ink-faint)", display: "flex" }}><Icon name="search" size={18} /></span>
          <input
            aria-label="Search expense notes"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            style={{ flex: 1, minWidth: 0, border: 0, background: "none", outline: "none", font: "600 16px var(--font-body)", color: "var(--ink)" }}
          />
        </label>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 2 }}>
        <CategoryChip on={categoryFilter === ""} onClick={() => setCategoryFilter("")}>All</CategoryChip>
        {categories.map((c) => (
          <CategoryChip key={c.id} on={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)}>{c.name}</CategoryChip>
        ))}
      </div>

      <SectionTitle count={fmt(total) + " EGP"} right={<button onClick={() => setManagingCats(true)} style={{ border: 0, background: "none", font: "700 13px var(--font-body)", color: "var(--primary-pressed)", cursor: "pointer" }}>Categories</button>}>
        Expenses
      </SectionTitle>

      <PlainCard style={{ overflow: "hidden", marginBottom: 14 }}>
        {coachPayouts > 0 && !categoryFilter && !query && (
          <button className="bq-scale" onClick={onCoachPayouts} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: 0, borderBottom: "1px solid var(--line)", background: "var(--sunken)", cursor: "pointer", textAlign: "left", padding: "13px 18px" }}>
            <div className="bq-grow">
              <div style={{ font: "700 15px var(--font-body)" }}>Coach payouts</div>
              <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>Settled this month · locked</div>
            </div>
            <div className="tabular" style={{ flex: "none", font: "800 15px var(--font-mono)" }}>{fmt(coachPayouts)}</div>
            <Icon name="chevron-right" size={16} />
          </button>
        )}
        {expenses.map((e, i) => (
          <button key={e.id} className="bq-scale" onClick={() => setSheetMode(e)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left", padding: "13px 18px", borderBottom: i === expenses.length - 1 ? "none" : "1px solid var(--line)" }}>
            <div className="bq-grow">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.categoryName}</span>
                <ReceiptIcon has={e.hasReceipt} />
              </div>
              <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {e.date.slice(8, 10)} {monthAbbr(e.date.slice(0, 7))}{e.note ? ` · ${e.note}` : ""}{e.editedAfterMonthEnd ? " · edited after month end" : ""}
              </div>
            </div>
            <div className="tabular" style={{ flex: "none", font: "800 15px var(--font-mono)" }}>{fmt(e.amount)}</div>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
        {expenses.length === 0 && coachPayouts === 0 && (
          <EmptyState bare icon="cash" title={data ? "No expenses this month" : "Loading…"} body="Rent, salaries, utilities — whatever the business spent on. Add the first one below." />
        )}
      </PlainCard>

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

function CategoryChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      style={{ flex: "none", height: 32, padding: "0 12px", borderRadius: 999, border: `1px solid ${on ? "var(--primary)" : "var(--line)"}`, background: on ? "var(--primary-tint)" : "var(--surface)", color: on ? "var(--primary-pressed)" : "var(--ink)", font: "700 12px var(--font-body)", whiteSpace: "nowrap", cursor: "pointer" }}
    >
      {children}
    </button>
  );
}

export const catOptions = (cats: ExpenseCategory[]) => cats.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }));

import { useMemo, useState } from "react";
import { useSetHeader } from "../../../shared/screen/header";
import { useSticky } from "../../../design-system/hooks/useSticky";
import { Segmented } from "../../../design-system/components/Segmented";
import { YearMonthStrip } from "../../../design-system/components/YearMonthStrip";
import { useNavigate } from "react-router-dom";
import { isMonth, monthsBack } from "../domain/accounting";
import { CURRENT_MONTH, useAccounting } from "./hooks/useAccounting";
import { PnlPanel } from "./PnlPanel";
import { ExpensesPanel } from "./Expenses";
import { RecurringPanel } from "./Recurring";

type Tab = "pnl" | "expenses" | "recurring";

/** Profit & loss, expenses, and the recurring templates that generate them —
 * one route, three in-page tabs (same pattern as Catalog), so neither the
 * accountant's nor the founder's bottom nav grows past Material's 5-tab cap. */
export function Accounting() {
  const navigate = useNavigate();
  const [tab, setTab] = useSticky<Tab>("accountingTab", "pnl", { valid: (v) => ["pnl", "expenses", "recurring"].includes(v) });
  const [month, setMonth] = useSticky<string>("accountingMonth", CURRENT_MONTH, { valid: isMonth });
  const [addingExpense, setAddingExpense] = useState(false);
  useSetHeader({ kicker: "BUSINESS", title: "Accounting" }, []);

  const { categories, refetchCategories, pnl, expensesChanged } = useAccounting(month);
  const months = useMemo(() => monthsBack(24, CURRENT_MONTH), []);

  return (
    <div>
      <div className="bq-flex bq-justify-center bq-mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "pnl", label: "P&L" },
            { value: "expenses", label: "EXPENSES" },
            { value: "recurring", label: "RECURRING" },
          ]}
        />
      </div>

      {tab !== "recurring" && <YearMonthStrip months={months} value={month} onChange={setMonth} currentMonth={CURRENT_MONTH} />}

      <div key={tab} className="bq-rise">
        {tab === "pnl" && (
          <PnlPanel
            report={pnl}
            loading={!pnl}
            onAddExpense={() => {
              setTab("expenses");
              window.setTimeout(() => setAddingExpense(true), 280);
            }}
            onCoachPayouts={() => navigate("/pay")}
          />
        )}
        {tab === "expenses" && (
          <ExpensesPanel
            month={month}
            categories={categories}
            coachPayouts={pnl?.current.coachPayouts ?? 0}
            openAdd={addingExpense}
            onAddHandled={() => setAddingExpense(false)}
            onCoachPayouts={() => navigate("/pay")}
            onChanged={expensesChanged}
            onCategoriesChanged={refetchCategories}
          />
        )}
        {tab === "recurring" && (
          <RecurringPanel categories={categories} onChanged={expensesChanged} onCategoriesChanged={refetchCategories} />
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { useSetHeader } from "../lib/header";
import { useSticky } from "../lib/useSticky";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { Segmented } from "../components/Segmented";
import { YearMonthStrip } from "../components/YearMonthStrip";
import { useNavigate } from "react-router-dom";
import { monthsBackList, useAsyncBump } from "./accounting/helpers";
import { PnlPanel } from "./accounting/PnlPanel";
import { ExpensesPanel } from "./accounting/Expenses";
import { RecurringPanel } from "./accounting/Recurring";

type Tab = "pnl" | "expenses" | "recurring";

/** Profit & loss, expenses, and the recurring templates that generate them —
 * one route, three in-page tabs (same pattern as Catalog), so neither the
 * accountant's nor the founder's bottom nav grows past Material's 5-tab cap. */
export function Accounting() {
  const navigate = useNavigate();
  const [tab, setTab] = useSticky<Tab>("accountingTab", "pnl", { valid: (v) => ["pnl", "expenses", "recurring"].includes(v) });
  const [month, setMonth] = useSticky<string>("accountingMonth", MOCK.CURRENT_MONTH, { valid: (v) => /^\d{4}-\d{2}$/.test(v) });
  const [addingExpense, setAddingExpense] = useState(false);
  useSetHeader({ kicker: "BUSINESS", title: "Accounting" }, []);

  const cats = useAsync(() => api.expenseCategories(), []);
  const bump = useAsyncBump();
  const pnl = useAsync(() => api.pnl(month), [month, bump.key]);

  const months = useMemo(() => monthsBackList(24), []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
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

      {tab !== "recurring" && <YearMonthStrip months={months} value={month} onChange={setMonth} />}

      <div key={tab} className="bq-rise">
        {tab === "pnl" && (
          <PnlPanel
            report={pnl.data ?? null}
            loading={!pnl.data}
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
            categories={cats.data?.categories ?? []}
            coachPayouts={pnl.data?.current.coachPayouts ?? 0}
            openAdd={addingExpense}
            onAddHandled={() => setAddingExpense(false)}
            onCoachPayouts={() => navigate("/pay")}
            onChanged={bump.bump}
            onCategoriesChanged={cats.refetch}
          />
        )}
        {tab === "recurring" && (
          <RecurringPanel categories={cats.data?.categories ?? []} onChanged={bump.bump} onCategoriesChanged={cats.refetch} />
        )}
      </div>
    </div>
  );
}

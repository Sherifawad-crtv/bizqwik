import { EmptyState } from "../components/EmptyState";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSetHeader } from "../lib/header";
import { useSticky } from "../lib/useSticky";
import { useAsync } from "../lib/useAsync";
import { useLatch } from "../lib/useLatch";
import { useSheetSuccess } from "../lib/useSheetSuccess";
import { api, MOCK } from "../lib/backend";
import { fmt, monthAbbr, monthLabel } from "../lib/format";
import { receiptDataUrl } from "../lib/image";
import type { Expense, ExpenseCategory, PnlReport, RecurringExpense } from "../lib/types";
import { Segmented } from "../components/Segmented";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { TextField, SelectField } from "../components/FormField";
import { DateField } from "../components/DateField";
import { YearMonthStrip } from "../components/YearMonthStrip";
import { Spinner } from "../components/Spinner";
import { SheetSuccessIcon } from "../components/SheetSuccessIcon";
import { Card as PlainCard, SectionTitle } from "./frontdesk/shared";
import { Card, KpiTile, Delta, pctChange, caption, ShareBars, useMeasuredWidth, roundedTopBarPath } from "./Oversight";
import { useNavigate } from "react-router-dom";

type Tab = "pnl" | "expenses" | "recurring";

const monthsBackList = (n: number): string[] => {
  const [y, m] = MOCK.CURRENT_MONTH.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
};

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
  );
}

/** A small local "something changed, re-fetch" counter — the same idea as
 * the app's global `bump()`, but scoped to this screen so an expense edit
 * refreshes the P&L tab without re-fetching every open screen in the app. */
function useAsyncBump() {
  const [key, setKey] = useState(0);
  return { key, bump: () => setKey((k) => k + 1) };
}

// ---- P&L ------------------------------------------------------------

function PnlChart({ trend }: { trend: PnlReport["trend"] }) {
  const [ref, W] = useMeasuredWidth(320);
  const H = 210;
  const top = 26;
  const bottom = 172;
  const max = Math.max(...trend.map((m) => Math.max(m.netRevenue, m.totalExpenses)), 1) * 1.15;
  const y = (v: number) => bottom - (v / max) * (bottom - top);
  const slot = W / trend.length;
  const barW = Math.max(6, Math.min(18, slot / 3));
  const [hover, setHover] = useState<number | null>(null);
  const REV = "var(--primary)";
  const EXP = "var(--accent)";

  if (trend.every((m) => m.netRevenue === 0 && m.totalExpenses === 0)) {
    return <EmptyState bare icon="insights" title="No activity yet" body="Once there's revenue or an expense logged, this fills in month by month." />;
  }
  return (
    <div ref={ref} style={{ width: "100%", position: "relative" }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        {[["Net revenue", REV], ["Expenses", EXP]].map(([label, color]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6, font: "700 11px var(--font-mono)", letterSpacing: ".04em", color: "var(--ink-muted)" }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "block" }} />
            {String(label).toUpperCase()}
          </span>
        ))}
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }} role="img" aria-label="Net revenue and expenses by month">
        {[top, (top + bottom) / 2, bottom].map((gy, i) => (
          <line key={i} x1={0} y1={gy} x2={W} y2={gy} stroke="var(--line)" strokeWidth={1} />
        ))}
        {trend.map((m, i) => {
          const cx = (i + 0.5) * slot;
          return (
            <g key={m.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={i * slot} y={0} width={slot} height={H} fill="transparent" />
              {m.netRevenue > 0 && <path d={roundedTopBarPath(cx - barW - 1, y(m.netRevenue), barW, bottom, 4)} fill={REV} />}
              {m.totalExpenses > 0 && <path d={roundedTopBarPath(cx + 1, y(m.totalExpenses), barW, bottom, 4)} fill={EXP} />}
              <text x={cx} y={H - 4} textAnchor="middle" style={{ font: "700 10px var(--font-mono)", letterSpacing: ".06em", fill: "var(--ink-faint)" }}>
                {monthAbbr(m.month).toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div style={{ position: "absolute", top: 30, left: Math.min(Math.max((hover + 0.5) * slot - 80, 0), W - 160), width: 160, background: "var(--ink)", color: "var(--surface)", borderRadius: 12, padding: "8px 12px", font: "600 12px/1.6 var(--font-mono)", pointerEvents: "none" }}>
          <div style={{ fontWeight: 800 }}>{monthAbbr(trend[hover].month)}</div>
          <div>Net revenue {fmt(trend[hover].netRevenue)}</div>
          <div>Expenses {fmt(trend[hover].totalExpenses)}</div>
          <div>Profit {fmt(trend[hover].profit)}</div>
        </div>
      )}
    </div>
  );
}

function PnlPanel({ report, loading, onAddExpense, onCoachPayouts }: { report: PnlReport | null; loading: boolean; onAddExpense: () => void; onCoachPayouts: () => void }) {
  if (loading || !report) return <Spinner />;
  if (!report.hasPastExpenses && report.current.grossRevenue === 0) {
    return (
      <EmptyState
        icon="cash"
        title="Nothing to show yet"
        body="Profit & loss fills in once there's revenue or an expense logged. Rent, salaries, utilities and the other default categories are already set up — add your first expense to get started."
        action={{ label: "Add an expense", onClick: onAddExpense }}
      />
    );
  }
  const { current } = report;
  const prev = report.trend.length >= 2 ? report.trend[report.trend.length - 2] : null;
  const margin = current.netRevenue > 0 ? (current.profit / current.netRevenue) * 100 : null;

  return (
    <>
      {report.unsettledNote && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--logging-bg)", borderRadius: 14, padding: "12px 14px", marginBottom: 14 }}>
          <span style={{ color: "var(--logging-fg)", display: "flex", flex: "none", marginTop: 1 }}>
            <Icon name="insights" size={18} />
          </span>
          <span style={{ font: "500 13px/1.5 var(--font-body)", color: "var(--logging-fg)" }}>
            {report.unsettledNote.count} coach session{report.unsettledNote.count === 1 ? "" : "s"} {report.unsettledNote.count === 1 ? "isn't" : "aren't"} settled yet, so payouts may be understated.
          </span>
        </div>
      )}

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "20px 20px 18px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>REVENUE · EGP</span>
          {prev && <span style={{ marginLeft: "auto" }}><Delta pct={pctChange(current.netRevenue, prev.netRevenue)} tone="good" /></span>}
        </div>
        <div className="tabular" style={{ font: "800 48px/1 var(--font-body)", letterSpacing: "-.03em", margin: "8px 0 0", overflowWrap: "anywhere" }}>{fmt(current.netRevenue)}</div>
        <div style={{ font: "400 12px/1.4 var(--font-mono)", color: "var(--ink-faint)", marginTop: 8 }}>
          {current.refunds > 0 ? `${fmt(current.grossRevenue)} gross − ${fmt(current.refunds)} refunded` : "No refunds this month"}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
        <KpiTile label="EXPENSES" icon="topay" value={fmt(current.totalExpenses)} sub={`${fmt(current.coachPayouts)} coach payouts`} delta={prev && <Delta pct={pctChange(current.totalExpenses, prev.totalExpenses)} tone="neutral" />} />
        <KpiTile label="PROFIT" icon="insights" value={fmt(current.profit)} sub={margin !== null ? `${margin >= 0 ? "" : "−"}${Math.abs(Math.round(margin))}% margin` : "Margin needs revenue"} delta={prev && <Delta pct={pctChange(current.profit, prev.profit)} tone="good" />} />
      </div>

      <Card title="NET REVENUE VS EXPENSES" sub={`${caption(report.trend.map((m) => m.month))} · BY MONTH · EGP`}>
        <PnlChart trend={report.trend} />
      </Card>

      <Card title="WHERE THE MONEY CAME FROM" sub={`${monthLabel(current.month).toUpperCase()} · EGP`}>
        <ShareBars slices={report.revenueBySource} />
      </Card>

      <Card title="WHERE THE MONEY WENT" sub={`${monthLabel(current.month).toUpperCase()} · EGP`}>
        {report.expensesBySource.length === 0 ? (
          <EmptyState bare icon="insights" title="No expenses this month" body="Coach payouts and whatever you log show up here, largest first." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {report.expensesBySource.map((s) => (
              <button
                key={s.key}
                data-tap
                onClick={s.key === "coach_payouts" ? onCoachPayouts : undefined}
                disabled={s.key !== "coach_payouts"}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "none", padding: "6px 0", cursor: s.key === "coach_payouts" ? "pointer" : "default", textAlign: "left" }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ font: "600 14px var(--font-body)" }}>{s.label}</div>
                  {s.key === "coach_payouts" && <div style={{ font: "400 11px var(--font-mono)", color: "var(--ink-faint)" }}>Locked · settled only</div>}
                </span>
                <span className="tabular" style={{ font: "800 14px var(--font-body)" }}>{fmt(s.amount)}</span>
                {s.key === "coach_payouts" && <Icon name="chevron-right" size={14} style={{ color: "var(--ink-faint)" }} />}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Button fullWidth size="lg" style={{ marginTop: 4, marginBottom: 18 }} onClick={onAddExpense}>
        Add expense
      </Button>
    </>
  );
}

// ---- Expenses ---------------------------------------------------------

function ReceiptIcon({ has }: { has: boolean }) {
  if (!has) return null;
  return (
    <span style={{ color: "var(--ink-faint)", display: "flex", flex: "none" }}>
      <Icon name="card" size={14} />
    </span>
  );
}

function ExpensesPanel({
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
        <label data-sq style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 14px", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)" }}>
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
          <button data-tap onClick={onCoachPayouts} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: 0, borderBottom: "1px solid var(--line)", background: "var(--sunken)", cursor: "pointer", textAlign: "left", padding: "13px 18px" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 15px var(--font-body)" }}>Coach payouts</div>
              <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>Settled this month · locked</div>
            </div>
            <div className="tabular" style={{ flex: "none", font: "800 15px var(--font-mono)" }}>{fmt(coachPayouts)}</div>
            <Icon name="chevron-right" size={16} />
          </button>
        )}
        {expenses.map((e, i) => (
          <button key={e.id} data-tap onClick={() => setSheetMode(e)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left", padding: "13px 18px", borderBottom: i === expenses.length - 1 ? "none" : "1px solid var(--line)" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
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

const catOptions = (cats: ExpenseCategory[]) => cats.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name }));

/** Add or edit one expense: amount, category, date (today by default), note,
 * an optional receipt photo, and — add mode only — "repeat monthly", which
 * creates a template instead of (or alongside) this one-off row. Everything
 * after the amount has a sensible default, so a quick add is a handful of
 * taps: open, type the number, confirm. */
function ExpenseSheet({
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
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{editing ? "EDIT EXPENSE" : "ADD EXPENSE"}</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>
            {editing ? editing.categoryName : "What did the business spend on?"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label data-sq style={{ display: "block", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px" }}>
              <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>AMOUNT (EGP)</span>
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
                  data-sq
                  onClick={() => fileInput.current?.click()}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px", cursor: "pointer" }}
                >
                  <Icon name="card" size={18} style={{ color: "var(--ink-faint)" }} />
                  <span style={{ font: "600 14px var(--font-body)" }}>{receipt ? "Receipt attached" : "Attach a receipt photo (optional)"}</span>
                </button>
              </>
            )}

            {!editing && (
              <label data-sq style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px", cursor: "pointer" }}>
                <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} style={{ width: 18, height: 18 }} />
                <span style={{ font: "600 14px var(--font-body)" }}>Repeat monthly</span>
              </label>
            )}
            {!editing && repeat && (
              <TextField label="DAY OF MONTH (1–28)" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} inputMode="numeric" />
            )}
          </div>
          {error && (
            <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>
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

function CategoriesSheet({ open, categories, onClose, onChanged }: { open: boolean; categories: ExpenseCategory[]; onClose: () => void; onChanged: () => void }) {
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
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "0 0 16px" }}>Expense categories</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {categories.map((c) => (
          <div key={c.id} data-sq style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 14px" }}>
            <span style={{ flex: 1, font: "600 15px var(--font-body)" }}>{c.name}</span>
            {!c.isDefault && (
              <button
                onClick={() => api.setExpenseCategoryArchived(c.id, true).then(onChanged)}
                style={{ border: 0, background: "none", color: "var(--danger-fg)", font: "700 12px var(--font-mono)", cursor: "pointer" }}
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
          {error && <div style={{ marginTop: 8, font: "600 13px var(--font-body)", color: "var(--danger-fg)" }}>{error}</div>}
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

function nextOccurrence(r: RecurringExpense): string | null {
  if (!r.active) return null;
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  for (let i = 0; i < 24; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, r.dayOfMonth);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (month < r.startMonth) continue;
    if (r.endMonth && month > r.endMonth) return null;
    const iso = d.toISOString().slice(0, 10);
    if (iso >= todayIso) return iso;
  }
  return null;
}

function RecurringPanel({ categories, onChanged, onCategoriesChanged }: { categories: ExpenseCategory[]; onChanged: () => void; onCategoriesChanged: () => void }) {
  const { data, refetch } = useAsync(() => api.recurringExpenses(), []);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [managingCats, setManagingCats] = useState(false);
  const recurring = data?.recurring ?? [];

  return (
    <div>
      <SectionTitle count={recurring.length} right={<button onClick={() => setManagingCats(true)} style={{ border: 0, background: "none", font: "700 13px var(--font-body)", color: "var(--primary-pressed)", cursor: "pointer" }}>Categories</button>}>
        Recurring expenses
      </SectionTitle>
      <PlainCard style={{ overflow: "hidden", marginBottom: 14 }}>
        {recurring.map((r, i) => {
          const next = nextOccurrence(r);
          return (
            <button key={r.id} data-tap onClick={() => setEditing(r)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left", padding: "13px 18px", borderBottom: i === recurring.length - 1 ? "none" : "1px solid var(--line)", opacity: r.active ? 1 : 0.5 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: "700 15px var(--font-body)" }}>{r.categoryName}{r.note ? ` · ${r.note}` : ""}</div>
                <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>
                  Day {r.dayOfMonth} · {r.active ? (next ? `Next ${next.slice(8, 10)} ${monthAbbr(next.slice(0, 7))}` : "Ended") : "Paused"}
                </div>
              </div>
              <div className="tabular" style={{ flex: "none", font: "800 15px var(--font-mono)" }}>{fmt(r.amount)}</div>
              <Icon name="chevron-right" size={16} />
            </button>
          );
        })}
        {recurring.length === 0 && (
          <EmptyState bare icon="cash" title={data ? "No repeating expenses" : "Loading…"} body="Rent, salaries and anything else that happens every month — set it up once." />
        )}
      </PlainCard>
      <Button fullWidth size="lg" style={{ marginBottom: 18 }} onClick={() => setEditing({ id: "", categoryId: categories.find((c) => !c.archived)?.id ?? "", categoryName: "", amount: 0, note: null, dayOfMonth: new Date().getDate() > 28 ? 28 : new Date().getDate(), startMonth: MOCK.CURRENT_MONTH, endMonth: null, active: true })}>
        Add a repeating expense
      </Button>
      <RecurringSheet
        template={editing}
        categories={categories}
        onClose={() => setEditing(null)}
        onSaved={() => {
          refetch();
          onChanged();
        }}
      />
      <CategoriesSheet open={managingCats} categories={categories} onClose={() => setManagingCats(false)} onChanged={onCategoriesChanged} />
    </div>
  );
}

function RecurringSheet({ template, categories, onClose, onSaved }: { template: RecurringExpense | null; categories: ExpenseCategory[]; onClose: () => void; onSaved: () => void }) {
  const shown = useLatch(template);
  const isNew = !shown?.id;
  const open = template !== null;
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [note, setNote] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [endMonth, setEndMonth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (!open || !shown) return;
    setAmount(shown.amount ? String(shown.amount) : "");
    setCategoryId(shown.categoryId);
    setNote(shown.note ?? "");
    setDayOfMonth(String(shown.dayOfMonth));
    setEndMonth(shown.endMonth ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shown?.id]);

  if (!shown) return null;

  const save = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError("Enter an amount.");
    if (!categoryId) return setError("Choose a category.");
    const day = Number(dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 28) return setError("Pick a day between 1 and 28.");
    setBusy(true);
    setError(null);
    try {
      if (isNew) {
        await api.createRecurringExpense(categoryId, amt, day, note.trim() || undefined, endMonth || undefined);
      } else {
        await api.updateRecurringExpense(shown.id, { amount: amt, categoryId, note: note.trim(), dayOfMonth: day, endMonth: endMonth || null });
      }
      onSaved();
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };
  const togglePause = async () => {
    setBusy(true);
    try {
      await api.updateRecurringExpense(shown.id, { active: !shown.active });
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={isNew ? "Repeating expense set up" : "Saved"} iconIn={iconIn} />
      ) : (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{isNew ? "ADD REPEATING EXPENSE" : "EDIT TEMPLATE"}</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{isNew ? "Every month" : shown.categoryName}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField label="AMOUNT (EGP)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" />
            <SelectField label="CATEGORY" value={categoryId} onChange={setCategoryId} placeholder="Choose a category" options={catOptions(categories)} />
            <TextField label="DAY OF MONTH (1–28)" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} inputMode="numeric" />
            <TextField label="NOTE (OPTIONAL)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What it's for" />
            <TextField label="ENDS (OPTIONAL, YYYY-MM)" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} placeholder="Leave blank to repeat forever" />
          </div>
          <div style={{ marginTop: 8, font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
            {isNew ? "Changing this later only affects future months — rows already made stay as they are." : "Editing changes future months only. Rows already made for past months are untouched."}
          </div>
          {error && <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
            {busy ? "Saving…" : isNew ? "Set up repeating expense" : "Save changes"}
          </Button>
          {!isNew && (
            <>
              <Button variant="secondary" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={togglePause}>
                {shown.active ? "Pause" : "Resume"}
              </Button>
              <Button variant="danger" fullWidth style={{ marginTop: 8 }} onClick={() => setConfirmingDelete(true)}>
                Delete template
              </Button>
              <ConfirmSheet
                open={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
                kicker="DELETE TEMPLATE"
                title="Delete this template?"
                sub="Expenses it already created stay — this just stops making new ones."
                confirmLabel="Delete"
                danger
                onConfirm={async () => {
                  await api.deleteRecurringExpense(shown.id);
                  onSaved();
                  onClose();
                }}
              />
            </>
          )}
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

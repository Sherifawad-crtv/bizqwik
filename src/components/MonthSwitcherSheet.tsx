import { Sheet } from "./Sheet";
import { StatePill } from "./StatePill";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { monthLabel } from "../lib/format";

interface MonthSwitcherSheetProps {
  open: boolean;
  onClose: () => void;
  coachId: string;
  month: string;
  onChange: (m: string) => void;
}

export function MonthSwitcherSheet({ open, onClose, coachId, month, onChange }: MonthSwitcherSheetProps) {
  const { data } = useAsync(async () => {
    const rollups = await Promise.all(MOCK.MONTHS.map((m) => api.month(m)));
    return MOCK.MONTHS.map((m, i) => ({ month: m, row: rollups[i].rows.find((r) => r.coachId === coachId) ?? null }));
  }, [coachId, open]);

  if (!open) return null;

  const months = MOCK.MONTHS.slice().reverse();

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>MONTH</div>
      <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Pick a month</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {months.map((m) => {
          const row = data?.find((d) => d.month === m)?.row ?? null;
          const on = m === month;
          return (
            <button
              key={m}
              onClick={() => {
                onChange(m);
                onClose();
              }}
              data-sq
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: on ? "var(--primary-tint)" : "var(--sunken)",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-input)",
                padding: "14px 16px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ font: "700 16px var(--font-body)", color: on ? "var(--primary-pressed)" : "var(--ink)" }}>{monthLabel(m)}</span>
              {row && <span style={{ marginLeft: "auto" }}><StatePill state={row.state} /></span>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

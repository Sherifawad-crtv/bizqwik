import { useState } from "react";
import { MonthSegmented } from "./MonthSegmented";
import { Sheet } from "./Sheet";
import { Icon } from "./Icon";
import { useIsMobile } from "../lib/useIsMobile";
import { MOCK } from "../lib/backend";
import { monthLabel, monthShort } from "../lib/format";

/** Desktop: inline segmented control. Mobile: compact badge that opens a sheet — keeps the
 * sticky header from being squeezed by a 3-button row next to the avatar + title. */
export function MonthPicker({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (!isMobile) return <MonthSegmented month={month} onChange={onChange} />;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-sq
        style={{ padding: "8px 12px", borderRadius: 16, border: 0, background: "var(--primary-tint)", font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--primary-pressed)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
      >
        {monthShort(month)} <Icon name="chevron-down" size={13} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>MONTH</div>
        <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Pick a month</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {MOCK.MONTHS.slice()
            .reverse()
            .map((m) => {
              const on = m === month;
              return (
                <button
                  key={m}
                  onClick={() => {
                    onChange(m);
                    setOpen(false);
                  }}
                  data-sq
                  style={{
                    textAlign: "left",
                    background: on ? "var(--primary-tint)" : "var(--sunken)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--r-input)",
                    padding: "14px 16px",
                    cursor: "pointer",
                    font: "700 16px var(--font-body)",
                    color: on ? "var(--primary-pressed)" : "var(--ink)",
                  }}
                >
                  {monthLabel(m)}
                </button>
              );
            })}
        </div>
      </Sheet>
    </>
  );
}

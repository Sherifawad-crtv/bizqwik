import { useEffect, useRef, useState } from "react";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { pad, timeLabel } from "../lib/classTime";

const ITEM_H = 44;
const VISIBLE = 5; // rows shown; the middle one is the selection

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)); // 1..12
const MINUTES = Array.from({ length: 12 }, (_, i) => pad(i * 5)); // 00..55
const PERIODS = ["AM", "PM"];

function split(hhmm: string): { h: number; m: number; pm: boolean } {
  const [H, M] = hhmm.split(":").map(Number);
  return { h: ((H + 11) % 12) + 1, m: Math.round(M / 5) * 5 % 60, pm: H >= 12 };
}
function join(h: number, m: number, pm: boolean): string {
  const H = (h % 12) + (pm ? 12 : 0);
  return `${pad(H)}:${pad(m)}`;
}

/** One snapping column. Scroll (or flick) and it settles on the nearest row;
 * tapping a row scrolls it into the middle. */
function Wheel({ items, index, onIndex, label }: { items: string[]; index: number; onIndex: (i: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | undefined>(undefined);

  // Position on open / when the value changes from outside.
  useEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM_H) !== index) el.scrollTop = index * ITEM_H;
  }, [index]);

  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
      if (i !== index) onIndex(i);
    }, 90);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      data-wheel={label}
      onScroll={onScroll}
      style={{
        flex: 1,
        height: ITEM_H * VISIBLE,
        overflowY: "auto",
        scrollSnapType: "y mandatory",
        scrollbarWidth: "none",
        overscrollBehavior: "contain",
        paddingTop: ITEM_H * 2,
        paddingBottom: ITEM_H * 2,
        boxSizing: "border-box",
        position: "relative",
        zIndex: 1,
        WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)",
        maskImage: "linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)",
      }}
    >
      {items.map((it, i) => (
        <div
          key={it}
          role="option"
          aria-selected={i === index}
          onClick={() => ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" })}
          style={{
            height: ITEM_H,
            scrollSnapAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: `${i === index ? 800 : 600} 22px var(--font-body)`,
            color: i === index ? "var(--ink)" : "var(--ink-faint)",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {it}
        </div>
      ))}
    </div>
  );
}

/** Time field with an iOS-style wheel picker (hour · minute · AM/PM, 5-min
 * steps). Value is 24h "HH:MM". Replaces the long single-list picker. */
export function TimeWheelField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => split(value));

  useEffect(() => {
    if (open) setDraft(split(value));
  }, [open, value]);

  return (
    <>
      <button
        type="button"
        data-sq
        onClick={() => setOpen(true)}
        aria-label={`${label}: ${timeLabel(value)}`}
        style={{ display: "block", width: "100%", textAlign: "left", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "10px 16px", cursor: "pointer" }}
      >
        <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "600 16px var(--font-body)", color: "var(--ink)" }}>{timeLabel(value)}</span>
          <span style={{ marginLeft: "auto", color: "var(--ink-faint)", display: "flex" }}>
            <Icon name="chevron-down" size={15} />
          </span>
        </div>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</div>
        <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 12px" }}>{timeLabel(join(draft.h, draft.m, draft.pm))}</div>
        <div style={{ position: "relative", display: "flex", gap: 4 }}>
          {/* selection band behind the middle row */}
          <div aria-hidden style={{ position: "absolute", left: 0, right: 0, top: ITEM_H * 2, height: ITEM_H, borderRadius: 12, background: "var(--accent-tint)" }} />
          <Wheel label="Hour" items={HOURS} index={draft.h - 1} onIndex={(i) => setDraft((d) => ({ ...d, h: i + 1 }))} />
          <Wheel label="Minute" items={MINUTES} index={draft.m / 5} onIndex={(i) => setDraft((d) => ({ ...d, m: i * 5 }))} />
          <Wheel label="AM/PM" items={PERIODS} index={draft.pm ? 1 : 0} onIndex={(i) => setDraft((d) => ({ ...d, pm: i === 1 }))} />
        </div>
        <Button
          fullWidth
          size="lg"
          style={{ marginTop: 16 }}
          onClick={() => {
            onChange(join(draft.h, draft.m, draft.pm));
            setOpen(false);
          }}
        >
          Done
        </Button>
      </Sheet>
    </>
  );
}

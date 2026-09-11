import { useState } from "react";
import { Avatar } from "./Avatar";
import { StatePill } from "./StatePill";
import { Icon } from "./Icon";
import { useIsMobile } from "../lib/useIsMobile";
import type { State } from "../lib/types";
import { egp } from "../lib/format";

export interface ListRow {
  id: string;
  name: string;
  title: string;
  meta: string;
  sub?: string;
  state?: State;
  amount: number;
  onClick?: () => void;
}

function DesktopRow({ r }: { r: ListRow }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={r.onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.3fr 1fr 1.1fr 20px",
        gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid var(--line)",
        alignItems: "center",
        cursor: r.onClick ? "pointer" : "default",
        background: r.onClick && hovered ? "var(--sunken)" : "transparent",
        transition: "background .15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={r.name} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "600 16px var(--font-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
          {r.sub && <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{r.sub}</div>}
        </div>
      </div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.meta}</div>
      <div>{r.state && <StatePill state={r.state} />}</div>
      <div className="tabular" style={{ textAlign: "right", font: "800 20px var(--font-body)", letterSpacing: "-.01em" }}>{egp(r.amount)}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", color: "var(--ink-faint)" }}>
        {r.onClick && <Icon name="chevron-right" size={16} />}
      </div>
    </div>
  );
}

export function RollupTable({ colA, colB, rows }: { colA: string; colB: string; rows: ListRow[] }) {
  const isMobile = useIsMobile();

  if (rows.length === 0) {
    return (
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
        <Icon name="inbox" size={26} />
        Nothing here yet.
      </div>
    );
  }

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            data-sq
            onClick={r.onClick}
            style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 16px", display: "flex", gap: 14, alignItems: "center", cursor: r.onClick ? "pointer" : "default" }}
          >
            <Avatar name={r.name} size={38} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.meta}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                {r.state && <StatePill state={r.state} />}
                {r.sub && <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{r.sub}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div className="tabular" style={{ font: "800 20px var(--font-body)", letterSpacing: "-.01em" }}>{egp(r.amount).split(" ")[0]}</div>
              <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>EGP</div>
            </div>
            {r.onClick && (
              <span style={{ flex: "none", color: "var(--ink-faint)", display: "flex" }}>
                <Icon name="chevron-right" size={16} />
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 1.1fr 20px", gap: 12, padding: "10px 20px", background: "var(--sunken)", font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-muted)" }}>
        <span>{colA}</span>
        <span>{colB}</span>
        <span>STATUS</span>
        <span style={{ textAlign: "right" }}>AMOUNT</span>
        <span />
      </div>
      {rows.map((r) => (
        <DesktopRow key={r.id} r={r} />
      ))}
    </div>
  );
}

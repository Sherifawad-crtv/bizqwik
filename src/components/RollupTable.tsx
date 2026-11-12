import { Avatar } from "./Avatar";
import { StatePill } from "./StatePill";
import { Icon } from "./Icon";
import { EmptyState } from "./EmptyState";
import type { ComponentProps } from "react";

type EmptyProps = Partial<ComponentProps<typeof EmptyState>>;
import { useIsMobile } from "../lib/useIsMobile";
import type { State } from "../lib/types";
import { egp } from "../lib/format";

export interface ListRow {
  id: string;
  name: string;
  avatarUrl?: string | null;
  title: string;
  meta: string;
  sub?: string;
  state?: State;
  amount: number;
  onClick?: () => void;
}

function DesktopRow({ r }: { r: ListRow }) {
  return (
    <div
      onClick={r.onClick}
      className={r.onClick ? "bq-row" : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1.3fr 1fr 1.1fr 20px",
        gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid var(--line)",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={r.name} size={32} src={r.avatarUrl} />
        <div style={{ minWidth: 0 }}>
          <div style={{ font: "600 var(--fs-base) var(--font-body)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
          {r.sub && <div className="bq-meta">{r.sub}</div>}
        </div>
      </div>
      <div style={{ font: "400 var(--fs-note) var(--font-mono)", color: "var(--ink-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.meta}</div>
      <div>{r.state && <StatePill state={r.state} />}</div>
      <div className="tabular" style={{ textAlign: "right", font: "800 var(--fs-title-sm) var(--font-body)", letterSpacing: "-.01em" }}>{egp(r.amount)}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", color: "var(--ink-faint)" }}>
        {r.onClick && <Icon name="chevron-right" size={16} />}
      </div>
    </div>
  );
}

export function RollupTable({
  colA,
  colB,
  rows,
  empty,
}: {
  colA: string;
  colB: string;
  rows: ListRow[];
  /** Why the list is empty and what to do about it. */
  empty?: EmptyProps;
}) {
  const isMobile = useIsMobile();

  if (rows.length === 0) {
    return <EmptyState icon="coaches" title="Nothing here yet" {...empty} />;
  }

  if (isMobile) {
    return (
      <div className="bq-stack">
        {rows.map((r) => (
          <div
            key={r.id}
            onClick={r.onClick}
            style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "14px 16px", display: "flex", gap: 14, alignItems: "center", cursor: r.onClick ? "pointer" : "default" }}
          >
            <Avatar name={r.name} size={38} src={r.avatarUrl} />
            <div className="bq-grow">
              <div style={{ font: "700 var(--fs-base) var(--font-body)", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
              <div style={{ font: "400 var(--fs-note) var(--font-mono)", color: "var(--ink-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.meta}</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                {r.state && <StatePill state={r.state} />}
                {r.sub && <span className="bq-meta">{r.sub}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div className="tabular" style={{ font: "800 var(--fs-title-sm) var(--font-body)", letterSpacing: "-.01em" }}>{egp(r.amount).split(" ")[0]}</div>
              <div className="bq-label">EGP</div>
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
    <div className="bq-panel">
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.3fr 1fr 1.1fr 20px", gap: 12, padding: "10px 20px", background: "var(--sunken)", font: "700 var(--fs-caption) var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-muted)" }}>
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

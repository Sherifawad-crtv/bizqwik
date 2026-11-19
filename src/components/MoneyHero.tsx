import type { ReactNode } from "react";
import { useIsMobile } from "../lib/useIsMobile";

interface Stat {
  k: string;
  v: string;
}

export function MoneyHero({ label, value, stats }: { label: string; value: ReactNode; stats: Stat[] }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="bq-card" style={{ padding: "20px 20px 18px", marginBottom: 14 }}>
        <div className="bq-label">{label}</div>
        <div className="tabular bq-stat-xl" style={{ margin: "6px 0 10px" }}>{value}</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {stats.map((s) => (
            <div key={s.k}>
              <div className="bq-label">{s.k}</div>
              <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)" }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 22 }}>
      <div className="bq-card bq-card--md">
        <div className="bq-label">{label}</div>
        <div className="tabular bq-stat-xl" style={{ marginTop: 6 }}>{value}</div>
      </div>
      {stats.map((s) => (
        <div key={s.k} className="bq-card bq-card--md">
          <div className="bq-label">{s.k}</div>
          <div style={{ font: "800 var(--text-large-title-size) var(--font-family-body)", letterSpacing: "-.02em", marginTop: 8 }}>{s.v}</div>
        </div>
      ))}
    </div>
  );
}

import type { ReactNode } from "react";
import { useIsMobile } from "../hooks/useIsMobile";

interface Stat {
  k: string;
  v: string;
}

export function MoneyHero({ label, value, stats }: { label: string; value: ReactNode; stats: Stat[] }) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="bq-card bq-money-hero-spacing">
        <div className="bq-label">{label}</div>
        <div className="tabular bq-stat-xl bq-money-hero-spacing-2">{value}</div>
        <div className="bq-flex bq-gap-4 bq-wrap">
          {stats.map((s) => (
            <div key={s.k}>
              <div className="bq-label">{s.k}</div>
              <div className="bq-money-hero-meta">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bq-money-hero-grid">
      <div className="bq-card bq-card--md">
        <div className="bq-label">{label}</div>
        <div className="tabular bq-stat-xl bq-mt-1-5">{value}</div>
      </div>
      {stats.map((s) => (
        <div key={s.k} className="bq-card bq-card--md">
          <div className="bq-label">{s.k}</div>
          <div className="bq-money-hero-title">{s.v}</div>
        </div>
      ))}
    </div>
  );
}

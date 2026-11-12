import { EmptyState } from "../../components/EmptyState";
import type { ReactNode } from "react";
import { Icon, type IconName } from "../../components/Icon";

export function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-tile)", padding: "16px 18px", marginBottom: 14 }}>
      <div className="bq-label">{title}</div>
      {sub && <div style={{ font: "400 var(--fs-small) var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>{sub}</div>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <EmptyState bare icon="insights" title={text} body="This fills in automatically as the front desk sells plans, packages and drop-ins." />;
}

/** Change vs the previous equal period. `tone` says how to colour it: revenue
 * and profit going up is good, payouts going up is just information. */
export function Delta({ pct, tone }: { pct: number | null; tone: "good" | "neutral" }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const flat = Math.abs(pct) < 0.05;
  const color = tone === "neutral" || flat ? "var(--ink-muted)" : up ? "var(--paid-fg)" : "var(--danger-fg)";
  const bg = tone === "neutral" || flat ? "var(--sunken)" : up ? "var(--paid-bg)" : "var(--danger-bg)";
  return (
    <span className="tabular" style={{ flex: "none", background: bg, color, borderRadius: 999, padding: "3px 9px", font: "700 var(--fs-caption) var(--font-mono)", letterSpacing: ".02em", whiteSpace: "nowrap" }}>
      {flat ? "–" : up ? "▲" : "▼"} {Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : (Math.round(Math.abs(pct) * 10) / 10).toString()}%
    </span>
  );
}

export function KpiTile({ label, value, sub, icon, delta }: { label: string; value: string; sub?: string; icon: IconName; delta?: ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 16px", minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 28, height: 28, flex: "none", borderRadius: 8, background: "var(--primary-tint)", color: "var(--primary-pressed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={16} />
        </span>
        <span style={{ marginLeft: "auto" }}>{delta}</span>
      </div>
      <div style={{ font: "700 var(--fs-caption) var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", marginTop: 10 }}>{label}</div>
      <div className="tabular" style={{ font: "800 24px/1.15 var(--font-body)", letterSpacing: "-.02em", marginTop: 2, overflowWrap: "anywhere" }}>{value}</div>
      {sub && <div style={{ font: "400 var(--fs-small)/1.4 var(--font-mono)", color: "var(--ink-faint)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
